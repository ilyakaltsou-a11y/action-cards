(function (root) {
  const durations = [15, 30, 60];
  function createClock(now = Date.now) {
    let remaining = 0;
    let started = 0;
    let lastAction = 0;
    let status = "off";
    function start(minutes) {
      if (!durations.includes(minutes)) return;
      remaining = minutes * 60000;
      started = lastAction = now();
      status = "running";
    }
    function snapshot() {
      if (status !== "running") return { status, remaining, warning: 0 };
      const time = now();
      const idleEnd = lastAction + 65000;
      const end = Math.min(started + remaining, idleEnd);
      if (time >= end) {
        remaining = Math.max(0, remaining - (end - started));
        status = remaining ? "paused" : "done";
        return { status, remaining, warning: 0 };
      }
      return { status, remaining: remaining - (time - started), warning: time >= lastAction + 60000 ? Math.ceil((idleEnd - time) / 1000) : 0 };
    }
    function pause() {
      const current = snapshot();
      if (current.status !== "running") return;
      remaining = current.remaining;
      status = "paused";
    }
    return {
      start, snapshot, pause,
      activity() { if (snapshot().status === "running") lastAction = now(); },
      resume() { if (status === "paused") { started = lastAction = now(); status = "running"; } },
      reset() { remaining = 0; status = "off"; },
    };
  }

  function create({ document, storage, open, close, schedule, now }) {
    const clock = createClock(now);
    const dialog = document.getElementById("studyTimeDialog");
    const label = document.getElementById("studyTimeLabel");
    const action = document.getElementById("studyTimeAction");
    const key = "action-cards:study-duration:v1";
    let active = false;
    let offered = false;
    let ready = false;
    function paint() {
      const { status, remaining, warning } = clock.snapshot();
      const seconds = Math.ceil(remaining / 1000);
      const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      label.hidden = status !== "running" || !active;
      label.textContent = warning ? `Пауза через ${warning} с · ${time}` : time;
      action.hidden = status === "running" || !active || !ready;
      action.textContent = status === "paused" ? `Продолжить · ${time}` : status === "done" ? "Время вышло · Новый таймер" : "Таймер";
    }
    function choose() {
      let preferred = 30;
      try { preferred = Number(storage.getItem(key)) || 30; } catch { /* Optional preference. */ }
      for (const button of dialog.querySelectorAll("[data-study-minutes]")) {
        button.classList.toggle("main-button", Number(button.dataset.studyMinutes) === preferred);
      }
      open(dialog);
    }
    for (const button of dialog.querySelectorAll("[data-study-minutes]")) {
      button.addEventListener("click", () => {
        const minutes = Number(button.dataset.studyMinutes);
        try { storage.setItem(key, String(minutes)); } catch { /* Timer works without storage. */ }
        clock.start(minutes);
        close(dialog);
        paint();
      });
    }
    document.getElementById("skipStudyTimeButton").addEventListener("click", () => { close(dialog); paint(); });
    action.addEventListener("click", () => {
      if (clock.snapshot().status === "paused") clock.resume(); else choose();
      paint();
    });
    for (const event of ["pointerdown", "pointerup", "click", "keydown", "input"]) {
      document.addEventListener(event, () => { if (active && !document.hidden) { clock.activity(); paint(); } }, true);
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden) clock.pause(); paint(); });
    schedule(() => { if (active) paint(); }, 250);
    return {
      render(nextActive, nextReady) {
        active = nextActive;
        ready = nextReady;
        if (!active) { offered = false; clock.reset(); close(dialog); }
        else if (ready && !offered) { offered = true; choose(); }
        paint();
      },
    };
  }
  root.ActionCardsStudyTimer = { create, createClock };
  if (typeof module !== "undefined") module.exports = root.ActionCardsStudyTimer;
})(globalThis);

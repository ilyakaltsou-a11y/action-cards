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
      restore(milliseconds) { remaining = milliseconds; status = remaining ? "paused" : "done"; },
      reset() { remaining = 0; status = "off"; },
    };
  }

  function create({ document, eventTarget, storage, getProfile, open, close, schedule, now }) {
    const clock = createClock(now);
    const dialog = document.getElementById("studyTimeDialog");
    const label = document.getElementById("studyTimeLabel");
    const action = document.getElementById("studyTimeAction");
    const preferenceKey = "action-cards:study-duration:v1";
    let active = false;
    let offered = false;
    let ready = false;
    let visible = false;
    let inViewport = true;
    let pageAway = false;
    let profile;
    let day;
    let minutes;
    let saved;
    const storageKey = () => `action-cards:study-time:v1:${profile}`;

    function checkpoint(current, exact = false) {
      if (!profile || current.status === "off") return;
      if (saved === current.remaining || (!exact && Math.floor(saved / 1000) === Math.floor(current.remaining / 1000))) return;
      try {
        storage.setItem(storageKey(), JSON.stringify({ day, minutes, remaining: current.remaining }));
        saved = current.remaining;
      } catch { /* The running timer does not depend on storage availability. */ }
    }

    function loadDay(nextProfile, nextDay) {
      if (day === nextDay && profile === nextProfile) return;
      const previous = clock.snapshot();
      if (day === nextDay) checkpoint(previous, true);
      const stayIdle = profile === nextProfile && visible && previous.status === "paused";
      profile = nextProfile;
      day = nextDay;
      offered = false;
      visible = stayIdle;
      saved = undefined;
      minutes = undefined;
      clock.reset();
      try {
        const preferred = Number(storage.getItem(preferenceKey));
        if (durations.includes(preferred)) minutes = preferred;
        const record = JSON.parse(storage.getItem(storageKey()) || "null");
        if (record?.day === day && durations.includes(record.minutes) && Number.isFinite(record.remaining)) {
          minutes = record.minutes;
          saved = Math.max(0, Math.min(minutes * 60000, record.remaining));
          clock.restore(saved);
          return;
        }
      } catch { /* Ignore corrupt or unavailable local storage. */ }
      if (minutes) clock.restore(minutes * 60000);
    }

    function update(interaction = false) {
      if (active || profile) loadDay(getProfile(), new Date(now()).toDateString());
      let nextVisible = active && ready && inViewport && !pageAway && !document.hidden && !document.querySelector("dialog[open], #studySessionOptions[open]");
      if (nextVisible && clock.snapshot().status === "off" && !offered) {
        offered = true;
        open(dialog);
        nextVisible = false;
      }
      const leaving = visible && !nextVisible;
      if (!nextVisible) clock.pause();
      else if (!visible || interaction) {
        clock.snapshot();
        clock.resume();
        clock.activity();
      }
      visible = nextVisible;
      const current = clock.snapshot();
      checkpoint(current, leaving || current.status === "done");
      const seconds = Math.ceil(current.remaining / 1000);
      const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      label.hidden = !visible || current.status === "off";
      const message = current.warning ? `Пауза через ${current.warning} с · ${time}` :
        current.status === "done" ? `Отличная работа! ${minutes} минут занятий` : current.status === "paused" ? `Пауза · ${time}` : time;
      label.dataset.status = current.status;
      if (label.textContent !== message) label.textContent = message;
      action.hidden = !visible || current.status !== "off";
    }

    for (const button of dialog.querySelectorAll("[data-study-minutes]")) {
      button.addEventListener("click", () => {
        minutes = Number(button.dataset.studyMinutes);
        try { storage.setItem(preferenceKey, String(minutes)); } catch { /* Timer works without storage. */ }
        clock.start(minutes);
        close(dialog);
        update();
      });
    }
    document.getElementById("skipStudyTimeButton").addEventListener("click", () => { close(dialog); update(); });
    action.addEventListener("click", () => {
      if (clock.snapshot().status === "off") { open(dialog); update(); }
    });
    for (const event of ["pointerdown", "pointerup", "click", "keydown", "input"]) {
      document.addEventListener(event, (e) => {
        if (active && e.target.closest?.(".study-card-stage, #revealStudyButton, .memory-controls")) update(true);
      }, true);
    }
    document.addEventListener("visibilitychange", () => update());
    eventTarget.addEventListener("pagehide", () => { pageAway = true; update(); });
    eventTarget.addEventListener("pageshow", () => { pageAway = false; update(); });
    const Observer = eventTarget.MutationObserver;
    if (Observer) {
      const observer = new Observer(() => { if (active) update(); });
      for (const overlay of document.querySelectorAll("dialog, #studySessionOptions")) observer.observe(overlay, { attributeFilter: ["open"] });
    }
    if (eventTarget.IntersectionObserver) {
      const observer = new eventTarget.IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting && entry.intersectionRatio > 0;
        if (active) update();
      });
      observer.observe(document.getElementById("flashcard"));
    }
    schedule(() => { if (active) update(); }, 250);
    return {
      render(nextActive, nextReady) {
        active = nextActive;
        ready = nextReady;
        if (!active) { offered = false; close(dialog); }
        update();
      },
    };
  }
  root.ActionCardsStudyTimer = { create, createClock };
  if (typeof module !== "undefined") module.exports = root.ActionCardsStudyTimer;
})(globalThis);

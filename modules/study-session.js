(function (root) {
  function create({ document, eventTarget, getCard, onClose, onRepeat, onSentences, onPolish, onCommand }) {
    const el = (id) => document.getElementById(id);
    const options = el("studySessionOptions");
    let active = false;
    const closeOptions = () => { options.removeAttribute("open"); };
    el("closeStudySessionButton").addEventListener("click", onClose);
    el("repeatStudyButton").addEventListener("click", onRepeat);
    el("sessionSentencesButton").addEventListener("click", onSentences);
    el("sessionPolishButton").addEventListener("click", onPolish);
    options.querySelectorAll("[data-study-command]").forEach((button) => {
      button.addEventListener("click", () => onCommand(button.dataset.studyCommand));
    });
    options.addEventListener("click", (event) => { if (event.target.closest?.("button")) closeOptions(); });
    document.addEventListener("click", (event) => { if (options.hasAttribute("open") && !options.contains(event.target)) closeOptions(); });
    eventTarget.addEventListener("keydown", (event) => {
      if (!active || event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      if (options.hasAttribute("open")) closeOptions(); else onClose();
    });
    function render(next = active) {
      active = next;
      document.body.classList.toggle("is-card-session", active);
      if (!active) closeOptions();
      for (const id of ["againButton", "repeatStudyButton", "gotItButton"]) el(id).disabled = !getCard();
    }
    return { render };
  }
  root.ActionCardsStudySession = { create };
})(globalThis);

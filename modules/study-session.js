(function (root) {
  function create({ document, eventTarget, getCard, getRevealState, onClose, onRepeat, onReveal, onSentences, onPolish, onCommand }) {
    const el = (id) => document.getElementById(id);
    const options = el("studySessionOptions");
    let active = false;
    const closeOptions = () => { options.removeAttribute("open"); };
    el("closeStudySessionButton").addEventListener("click", onClose);
    el("repeatStudyButton").addEventListener("click", onRepeat);
    el("revealStudyButton").addEventListener("click", onReveal);
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
      for (const id of ["againButton", "repeatStudyButton", "gotItButton", "revealStudyButton"]) el(id).disabled = !getCard();
      const { flipped, russian, translationVisible } = getRevealState();
      el("revealStudyButton").textContent = !flipped ? "Показать фразу" : russian ? "Показать русский текст" : translationVisible ? "К картинке" : "Показать перевод";
    }
    return { render };
  }
  root.ActionCardsStudySession = { create };
})(globalThis);

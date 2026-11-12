(function (root) {
  function normalizeAnswer(value) {
    return String(value || "").normalize("NFKC").toLowerCase()
      .replace(/['’‘ʼ]/gu, "").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
  }

  function createAnswer(document) {
    const input = document.getElementById("studyAnswerInput");
    const field = document.getElementById("studyAnswerField");
    const result = document.getElementById("studyAnswerResult");
    let cardId;
    let answer = null;
    function reset() { input.value = ""; answer = null; }
    return {
      reset,
      confirm(expected) {
        const text = input.value.trim();
        if (text && !answer) answer = { text, correct: normalizeAnswer(text) === normalizeAnswer(expected) };
      },
      canKnow: () => answer ? answer.correct : !input.value.trim(),
      pending: () => !answer && Boolean(input.value.trim()),
      submitted: () => Boolean(answer),
      render(card, flipped) {
        if (card?.id !== cardId) { cardId = card?.id; reset(); }
        field.hidden = !card || flipped;
        input.readOnly = Boolean(answer);
        result.hidden = !flipped || !answer;
        document.getElementById("studyAnswerOriginalLabel").hidden = result.hidden;
        document.getElementById("studyAnswerText").textContent = answer?.text || "";
        document.getElementById("studyAnswerStatus").textContent = answer ? (answer.correct ? "Совпадает" : "Не совпадает") : "";
        result.dataset.correct = String(Boolean(answer?.correct));
      },
    };
  }
  function create({ document, eventTarget, getCard, getRevealState, canKnow, hasDraft, onClose, onRepeat, onReveal, onSentences, onPolish, onCommand }) {
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
      el("gotItButton").disabled = !getCard() || !canKnow();
      const { flipped, russian, pronunciation, translationVisible } = getRevealState();
      el("revealStudyButton").textContent = !flipped ? (hasDraft() ? "Перевернуть и проверить" : pronunciation ? "Разговорный вариант" : "Показать фразу") : russian ? "Показать русский текст" : translationVisible ? (pronunciation ? "К полной фразе" : "К картинке") : "Показать перевод";
    }
    return { render };
  }
  root.ActionCardsStudySession = { create, createAnswer, normalizeAnswer };
  if (typeof module !== "undefined") module.exports = root.ActionCardsStudySession;
})(globalThis);

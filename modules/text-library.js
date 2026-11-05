(function (root) {
  function create({ document, getProfile, getLanguage, getExercises, getWordCount, onOpen, onDictionary }) {
    const el = (id) => document.getElementById(id);
    let view = "create", profile = "";
    function render() {
      if (profile !== getProfile()) { profile = getProfile(); view = "create"; }
      const active = document.body.dataset.section === "texts";
      document.body.dataset.textView = view;
      el("textsHeading").hidden = !active;
      el("textArchive").hidden = !active || view !== "library";
      if (!active) return;
      el("textsWordCount").textContent = `${getLanguage() === "polish" ? "Polski" : "English"} · ${getWordCount()} слов и фраз`;
      document.querySelectorAll("[data-text-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.textView === view)));
      if (!active || view !== "library") return;
      const list = el("textArchiveList"); list.replaceChildren();
      const exercises = getExercises().slice(0, 30);
      for (const exercise of exercises) {
        const button = document.createElement("button"); button.type = "button"; button.className = "saved-text";
        const title = document.createElement("strong"); title.textContent = exercise.promptRu;
        const meta = document.createElement("small");
        meta.textContent = `${({ easy: "A1–A2", medium: "A2", hard: "B1", manual: "Свой текст" })[exercise.mode] || "Задание"} · ${new Date(exercise.createdAt).toLocaleDateString("ru-RU")}`;
        button.append(title, meta);
        button.addEventListener("click", () => { view = "create"; render(); onOpen(exercise); });
        list.appendChild(button);
      }
      if (!exercises.length) { const empty = document.createElement("p"); empty.className = "empty-message"; empty.textContent = "Пока нет сохранённых заданий."; list.appendChild(empty); }
    }
    document.querySelectorAll("[data-text-view]").forEach((button) => button.addEventListener("click", () => { view = button.dataset.textView; render(); }));
    el("textsDictionaryButton").addEventListener("click", onDictionary);
    return { render };
  }
  root.ActionCardsTextLibrary = { create };
})(globalThis);

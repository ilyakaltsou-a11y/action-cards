(function (root) {
  function normalize(value = {}) {
    const unique = (items) => [...new Set((Array.isArray(items) ? items : [])
      .filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))].sort();
    const folders = unique(value.folderPaths);
    return {
      folderPaths: folders.includes("all") ? ["all"] : folders,
      cardIds: Array.isArray(value.cardIds) ? unique(value.cardIds) : null,
    };
  }

  function filter(cards, selection, matches) {
    const normalized = normalize(selection);
    const ids = normalized.cardIds === null ? null : new Set(normalized.cardIds);
    return cards.filter((card) => (!ids || ids.has(card.id)) && normalized.folderPaths.some((folder) => matches(card, folder)));
  }

  function create(options) {
    const { dialog, folders, list, search, summary, apply, all, none, more, getCards, getFolders, matches, onApply } = options;
    let draft = normalize();
    let selected = new Set();
    let limit = 100;
    const available = () => filter(getCards(), { ...draft, cardIds: null }, matches);
    const filtered = () => {
      const query = search.value.trim().toLocaleLowerCase();
      return available().filter((card) => `${card.phrase} ${card.translation} ${card.word} ${card.folderPath}`.toLocaleLowerCase().includes(query));
    };
    function updateSummary() {
      const count = available().filter((card) => selected.has(card.id)).length;
      summary.textContent = `${count} из ${available().length} карточек`;
      apply.disabled = count === 0;
      all.disabled = available().length === 0;
      none.disabled = count === 0;
    }
    function renderCards() {
      list.replaceChildren();
      const cards = filtered();
      for (const card of cards.slice(0, limit)) {
        const label = document.createElement("label");
        label.className = "practice-card-choice";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = card.id;
        input.checked = selected.has(card.id);
        const text = document.createElement("span");
        const phrase = document.createElement("span");
        phrase.textContent = card.phrase;
        const translation = document.createElement("small");
        translation.textContent = [card.translation, card.folderPath].filter(Boolean).join(" · ");
        text.append(phrase, translation);
        label.append(input, text);
        input.addEventListener("change", () => {
          if (input.checked) selected.add(card.id);
          else selected.delete(card.id);
          updateSummary();
        });
        list.append(label);
      }
      if (!cards.length) {
        const empty = document.createElement("p");
        empty.textContent = available().length ? "Ничего не найдено." : "Выберите папки с карточками.";
        list.append(empty);
      }
      more.hidden = cards.length <= limit;
      updateSummary();
    }
    function renderFolders() {
      folders.replaceChildren();
      for (const folder of ["all", ...getFolders()]) {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = folder;
        input.checked = draft.folderPaths.includes(folder);
        input.setAttribute("aria-label", folder === "all" ? "Все папки" : folder);
        const text = document.createElement("span");
        text.textContent = folder === "all" ? "Все папки" : folder;
        label.append(input, text);
        input.addEventListener("change", () => {
          const before = new Set(available().map((card) => card.id));
          const paths = draft.folderPaths.filter((path) => path !== "all" && path !== folder);
          if (input.checked) paths.push(folder);
          draft.folderPaths = folder === "all" ? (input.checked ? ["all"] : []) : paths;
          const after = available();
          const allowed = new Set(after.map((card) => card.id));
          selected = new Set([...selected].filter((id) => allowed.has(id)));
          for (const card of after) if (!before.has(card.id)) selected.add(card.id);
          limit = 100;
          renderFolders();
          renderCards();
          [...folders.querySelectorAll("input")].find((item) => item.value === folder)?.focus();
        });
        folders.append(label);
      }
    }
    search.addEventListener("input", () => { limit = 100; renderCards(); });
    all.addEventListener("click", () => { selected = new Set(available().map((card) => card.id)); renderCards(); });
    none.addEventListener("click", () => { selected.clear(); renderCards(); });
    more.addEventListener("click", () => { limit += 100; renderCards(); });
    apply.addEventListener("click", () => {
      const cards = available().filter((card) => selected.has(card.id));
      if (!cards.length) return;
      onApply(normalize({ ...draft, cardIds: cards.length === available().length ? null : cards.map((card) => card.id) }));
    });
    return {
      open(selection) {
        draft = normalize(selection);
        selected = new Set(filter(getCards(), draft, matches).map((card) => card.id));
        search.value = "";
        limit = 100;
        renderFolders();
        renderCards();
        dialog.showModal();
      },
    };
  }
  root.PracticeSelection = { normalize, filter, create };
})(globalThis);

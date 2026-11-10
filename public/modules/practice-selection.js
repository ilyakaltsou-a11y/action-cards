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
    const { dialog, folders, list, search, folderSearch, summary, apply, all, none, more, getCards, getFolders, matches, onApply } = options;
    let draft = normalize();
    let selected = new Set();
    let foldersChanged = false;
    let limit = 100;
    const available = () => filter(getCards(), { ...draft, cardIds: null }, matches);
    const filtered = () => {
      const query = search.value.trim().toLocaleLowerCase();
      return available().filter((card) => `${card.phrase} ${card.translation} ${card.word} ${card.folderPath}`.toLocaleLowerCase().includes(query));
    };
    function updateSummary() {
      const count = available().filter((card) => selected.has(card.id)).length;
      summary.textContent = `Выбрано карточек: ${count}`;
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
          renderFolders();
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
      const scrollTop = folders.scrollTop;
      folders.replaceChildren();
      const query = folderSearch?.value.trim().toLocaleLowerCase() || "";
      const matchingPaths = getFolders().filter((folder) => !query || folder.toLocaleLowerCase().includes(query));
      const paths = ["all", ...matchingPaths];
      for (const folder of paths) {
        const cards = getCards().filter((card) => matches(card, folder));
        const count = cards.filter((card) => selected.has(card.id)).length;
        const label = document.createElement("label");
        label.className = "practice-folder-choice";
        label.style.setProperty("--folder-depth", folder === "all" ? 0 : Math.min(4, folder.split(" / ").length - 1));
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = folder;
        input.checked = cards.length > 0 && count === cards.length;
        input.indeterminate = count > 0 && count < cards.length;
        input.disabled = cards.length === 0;
        input.setAttribute("aria-label", folder === "all" ? "Все папки" : folder);
        const text = document.createElement("span");
        text.textContent = folder === "all" ? "Все папки" : folder.split(" / ").at(-1);
        const total = document.createElement("small");
        total.textContent = String(cards.length);
        total.setAttribute("aria-label", `Карточек: ${cards.length}`);
        label.append(input, text, total);
        input.addEventListener("change", () => {
          foldersChanged = true;
          if (folder === "all") {
            draft.folderPaths = input.checked ? ["all"] : [];
            selected = new Set(input.checked ? getCards().map((card) => card.id) : []);
          } else if (input.checked) {
            draft.folderPaths = normalize({ folderPaths: [...draft.folderPaths, folder] }).folderPaths;
            for (const card of cards) selected.add(card.id);
          } else {
            draft.folderPaths = draft.folderPaths.filter((path) => path !== folder && !path.startsWith(`${folder} / `));
            for (const card of cards) selected.delete(card.id);
          }
          limit = 100;
          renderFolders();
          renderCards();
          [...folders.querySelectorAll("input")].find((item) => item.value === folder)?.focus();
        });
        folders.append(label);
      }
      if (query && !matchingPaths.length) {
        const empty = document.createElement("p"); empty.className = "empty-message"; empty.textContent = "Наборы не найдены."; folders.append(empty);
      }
      folders.scrollTop = scrollTop;
    }
    // Keep folder-wide selections open to future additions; use IDs only for genuine partial selections.
    function selectionForCards(cards) {
      const paths = draft.folderPaths.filter((path) => {
        const matching = getCards().filter((card) => matches(card, path));
        return matching.length > 0 && matching.every((card) => selected.has(card.id));
      });
      for (const card of cards) {
        if (paths.some((path) => matches(card, path))) continue;
        const path = getFolders().filter((path) => matches(card, path)).sort((a, b) => b.length - a.length)[0];
        if (path) paths.push(path);
      }
      const folderPaths = [...new Set(paths)].filter((path) => !paths.some((parent) => parent !== path && (parent === "all" || path.startsWith(`${parent} / `))));
      const scoped = filter(getCards(), { folderPaths }, matches);
      return normalize({ folderPaths, cardIds: scoped.every((card) => selected.has(card.id)) ? null : cards.map((card) => card.id) });
    }
    folderSearch?.addEventListener("input", renderFolders);
    search.addEventListener("input", () => { limit = 100; renderCards(); });
    all.addEventListener("click", () => { selected = new Set(available().map((card) => card.id)); renderFolders(); renderCards(); });
    none.addEventListener("click", () => { selected.clear(); renderFolders(); renderCards(); });
    more.addEventListener("click", () => { limit += 100; renderCards(); });
    apply.addEventListener("click", () => {
      const cards = available().filter((card) => selected.has(card.id));
      if (!cards.length) return;
      onApply(foldersChanged ? selectionForCards(cards) : normalize({ ...draft, cardIds: cards.length === available().length ? null : cards.map((card) => card.id) }));
    });
    return {
      open(selection) {
        draft = normalize(selection);
        foldersChanged = false;
        selected = new Set(filter(getCards(), draft, matches).map((card) => card.id));
        search.value = "";
        if (folderSearch) folderSearch.value = "";
        limit = 100;
        renderFolders();
        renderCards();
        folders.scrollTop = 0;
        dialog.showModal();
      },
    };
  }
  root.PracticeSelection = { normalize, filter, create };
})(globalThis);

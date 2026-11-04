(function (root) {
  const themes = [["alpine", "Альпы"], ["snow", "Снежные вершины"], ["forest", "Тихий лес"], ["desert", "Тёплые дюны"], ["moon", "Лунная ночь"], ["ocean", "Побережье"], ["aurora", "Северное сияние"], ["sunrise", "Рассвет"], ["stone", "Каменные горы"]];
  const time = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;
  const cardCount = (count) => `${count} ${{ one: "карточка", few: "карточки", many: "карточек", other: "карточки" }[new Intl.PluralRules("ru").select(count)]}`;
  function normalize(value = {}) {
    value = value && typeof value === "object" ? value : {};
    return { theme: themes.some(([id]) => id === value.theme) ? value.theme : "alpine", themeUpdatedAt: time(value.themeUpdatedAt),
      notes: (Array.isArray(value.notes) ? value.notes : []).filter((n) => n && typeof n.id === "string").map((n) => ({ id: n.id, title: String(n.title || "").slice(0, 120), body: String(n.body || "").slice(0, 20000), updatedAt: time(n.updatedAt), deletedAt: time(n.deletedAt) })),
      favorites: (Array.isArray(value.favorites) ? value.favorites : []).filter((f) => f && typeof f.id === "string").map((f) => ({ id: f.id, active: f.active === true, updatedAt: time(f.updatedAt) })) };
  }
  function merge(left, right) {
    left = normalize(left); right = normalize(right);
    const combine = (field) => {
      const entries = new Map();
      [...left[field], ...right[field]].forEach((entry) => { if (!entries.has(entry.id) || entry.updatedAt >= entries.get(entry.id).updatedAt) entries.set(entry.id, entry); });
      return [...entries.values()];
    };
    return { ...(right.themeUpdatedAt >= left.themeUpdatedAt ? right : left), notes: combine("notes"), favorites: combine("favorites") };
  }
  function create(options) {
    const { document, storage } = options;
    const el = (id) => document.getElementById(id);
    let screen = "home", noteId = "", noteTimer, noteProfile = "", undoId = "", period = 7, downloading = false;
    const selectedWords = new Set();
    let noteWordsBusy = false, noteExerciseEpoch = 0;
    const data = () => normalize(options.getData());
    const offlineKey = (profile) => `action-cards:offline:v1:${profile}`;
    const cacheName = (profile) => `action-cards:offline:v1:${profile}`;
    const offlineRecord = (profile = options.getProfile()) => { try { const saved = JSON.parse(storage.getItem(offlineKey(profile)) || "{}"); return Array.isArray(saved.cards) ? saved : { cards: [] }; } catch { return { cards: [] }; } };
    const set = (next, remote = true) => options.onChange(normalize(next), remote);

    function route(next) {
      if (!["home", "learn", "progress", "notes"].includes(next)) return;
      flushNote(); screen = next;
      document.body.dataset.screen = next;
      el("homeScreen").hidden = next !== "home"; el("progressScreen").hidden = next !== "progress"; el("notesScreen").hidden = next !== "notes";
      document.querySelectorAll(".main-dock [data-workspace-route]").forEach((button) => button.setAttribute("aria-current", button.dataset.workspaceRoute === next ? "page" : "false"));
      window.scrollTo?.(0, 0);
      render();
    }
    function renderThemes() {
      const grid = el("themeGrid");
      if (!grid.children.length) themes.forEach(([id, name]) => {
        const button = document.createElement("button"); button.type = "button"; button.className = "theme-swatch"; button.dataset.theme = id; button.title = name; button.setAttribute("aria-label", name);
        const image = document.createElement("img"); image.src = `assets/themes/${id}.jpg`; image.alt = ""; image.loading = "lazy";
        const label = document.createElement("span"); label.textContent = name;
        button.append(image, label); grid.appendChild(button);
        button.addEventListener("click", () => { const next = data(); next.theme = id; next.themeUpdatedAt = Date.now(); set(next); render(); });
      });
      grid.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.theme === data().theme)));
      document.body.style.setProperty("--landscape", `url("assets/themes/${data().theme}.jpg")`);
      document.body.dataset.theme = data().theme;
    }
    function renderFolders() {
      const list = el("homeFolders"); list.replaceChildren();
      options.getFolders().filter((folder) => options.getCards().some((card) => options.cardFolder(card) === folder)).slice(0, 6).forEach((folder) => {
        const cards = options.getCards().filter((card) => options.cardFolder(card) === folder);
        const button = document.createElement("button"); button.type = "button"; button.className = "landscape-folder";
        const image = document.createElement("img"); image.alt = ""; image.src = cards.find((c) => c.imageUrl)?.imageUrl || `assets/themes/${data().theme}.jpg`;
        const text = document.createElement("span"); const title = document.createElement("strong"); title.textContent = folder.split(" / ").at(-1);
        const count = document.createElement("small"); count.textContent = cardCount(cards.length); text.append(title, count);
        const arrow = document.createElement("span"); arrow.textContent = "›"; arrow.setAttribute("aria-hidden", "true"); button.append(image, text, arrow); list.appendChild(button);
        button.addEventListener("click", () => { options.onFolder(folder); route("learn"); });
      });
    }
    function renderProgress() {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const buckets = Array.from({ length: period === 7 ? 7 : period === 30 ? 10 : 12 }, () => 0);
      let total = 0;
      const days = options.getActivity().days || {};
      for (let i = 0; i < period; i++) {
        const date = new Date(today); date.setDate(date.getDate() - (period - 1 - i));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const count = Number(days[key]) || 0; total += count; buckets[Math.min(buckets.length - 1, Math.floor(i * buckets.length / period))] += count;
      }
      const chart = el("progressChart"); chart.replaceChildren(); const max = Math.max(1, ...buckets);
      buckets.forEach((count, index) => {
        const column = document.createElement("div"); column.className = "progress-column";
        const bar = document.createElement("span"); bar.style.height = `${Math.max(2, count / max * 160)}px`; bar.title = `${count} повторений`;
        const label = document.createElement("small"); label.textContent = period === 7 ? ["−6", "−5", "−4", "−3", "−2", "Вчера", "Сегодня"][index] : String(index + 1);
        column.append(bar, label); chart.appendChild(column);
      });
      chart.setAttribute("aria-label", `${total} повторений за ${period} дней`);
      const cards = options.getCards(); const reviewed = cards.filter((c) => c.attempts > 0).length;
      const totals = el("progressTotals"); totals.replaceChildren();
      [["Повторений", total], ["Карточек изучено", reviewed], ["Серия", `${options.summary().streak} дн.`], ["В базе", cards.length]].forEach(([label, value]) => {
        const item = document.createElement("div"); const name = document.createElement("small"); name.textContent = label;
        const number = document.createElement("strong"); number.textContent = String(value); item.append(name, number); totals.appendChild(item);
      });
    }
    function renderNotes() {
      if (noteProfile !== options.getProfile()) { noteId = ""; undoId = ""; noteProfile = options.getProfile(); el("noteEditor").hidden = true; }
      const query = el("notesSearch").value.trim().toLowerCase(); const list = el("notesList"); list.replaceChildren();
      const notes = data().notes.filter((n) => !n.deletedAt && `${n.title} ${n.body}`.toLowerCase().includes(query)).sort((a, b) => b.updatedAt - a.updatedAt);
      notes.forEach((note) => {
        const button = document.createElement("button"); button.type = "button"; button.className = "note-row"; button.setAttribute("aria-pressed", String(note.id === noteId));
        const title = document.createElement("strong"); title.textContent = note.title || "Без названия";
        const preview = document.createElement("span"); preview.textContent = note.body.slice(0, 110) || "Пустая заметка";
        const date = document.createElement("small"); date.textContent = new Date(note.updatedAt).toLocaleDateString("ru-RU"); button.append(title, preview, date);
        button.addEventListener("click", () => openNote(note.id)); list.appendChild(button);
      });
      if (!notes.length) { const empty = document.createElement("p"); empty.className = "empty-message"; empty.textContent = query ? "Ничего не найдено" : "Пока нет заметок"; list.appendChild(empty); }
      el("undoNoteButton").hidden = !undoId;
      el("practiceNoteButton").disabled = !data().notes.some((note) => note.id === noteId && !note.deletedAt && note.body.trim());
    }
    function openNote(id) {
      flushNote(); const note = data().notes.find((n) => n.id === id && !n.deletedAt); if (!note) return;
      noteId = id; noteProfile = options.getProfile(); el("noteEditor").hidden = false; el("noteTitle").value = note.title; el("noteBody").value = note.body; renderNotes();
    }
    el("noteEditor").addEventListener("submit", (event) => { event.preventDefault(); flushNote(); });
    function newNote(body = "") {
      const next = data(); const note = { id: crypto.randomUUID(), title: "", body, updatedAt: Date.now(), deletedAt: 0 }; next.notes.push(note); set(next); route("notes"); openNote(note.id); el("noteTitle").focus?.();
    }
    function flushNote() {
      if (noteTimer == null) return; clearTimeout(noteTimer); noteTimer = undefined;
      if (noteProfile === options.getProfile()) { set(data()); el("noteSaveState").textContent = "Сохранено на устройстве"; }
    }
    function editNote() {
      if (!noteId || noteProfile !== options.getProfile()) return;
      const next = data(); const note = next.notes.find((n) => n.id === noteId); if (!note) return;
      note.title = el("noteTitle").value; note.body = el("noteBody").value; note.updatedAt = Date.now();
      const okay = set(next, false); el("noteSaveState").textContent = okay === false ? "Не сохранено: память заполнена" : "Сохранено на устройстве";
      clearTimeout(noteTimer); noteTimer = setTimeout(flushNote, 900); renderNotes();
    }
    async function downloadCards(cards, silent = false) {
      if (!root.caches) { if (!silent) el("offlineStatus").textContent = "Офлайн-хранилище недоступно в этом браузере."; return; }
      const profile = options.getProfile(); const cache = await root.caches.open(cacheName(profile));
      const record = offlineRecord(profile); const ready = new Map(record.cards.map((c) => [c.id, c])); let failed = 0, completed = 0, cursor = 0, failureReason = "";
      if (!silent) el("offlineStatus").textContent = `Скачиваем: 0 из ${cards.length}…`;
      async function downloadNext() {
        while (cursor < cards.length) {
          const card = cards[cursor++];
          try {
            if (card.imageUrl && !card.imageUrl.startsWith("data:")) {
              const url = new URL(card.imageUrl, window.location.href);
              const source = url.origin === window.location.origin ? url.href : `/api/offline-image?url=${encodeURIComponent(url.href)}`;
              if (!await cache.match(url.href)) { const response = await fetch(source); if (!response.ok) throw new Error(`HTTP ${response.status}`); await cache.put(url.href, response); }
            }
            ready.set(card.id, { id: card.id, imageUrl: card.imageUrl || "" });
          } catch (error) {
            failed++;
            failureReason = error.name === "QuotaExceededError" ? "Недостаточно места на устройстве." : error.message === "HTTP 404" ? "Некоторые картинки больше недоступны на сервере." : error.message === "HTTP 400" ? "Этот внешний сайт не поддерживает загрузку картинок." : "Проверь интернет и повтори загрузку.";
          }
          completed++;
          if (!silent && options.getProfile() === profile) el("offlineStatus").textContent = `Скачиваем: ${completed} из ${cards.length}…`;
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, cards.length) }, downloadNext));
      storage.setItem(offlineKey(profile), JSON.stringify({ cards: [...ready.values()], updatedAt: Date.now() }));
      if (options.getProfile() === profile) { render(); if (!silent) el("offlineStatus").textContent = failed ? `Скачано: ${cards.length - failed} из ${cards.length}. Не удалось скачать: ${failed}. ${failureReason}` : `Скачано: ${cards.length} из ${cards.length}. На устройстве: ${cardCount(ready.size)}.`; }
    }
    function openOffline() {
      const list = el("offlineFolders"); list.replaceChildren();
      options.getFolders().forEach((folder) => {
        const label = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.value = folder; input.checked = false;
        const text = document.createElement("span"); text.textContent = `${folder} · ${options.getCards().filter((c) => options.cardFolder(c) === folder).length}`; label.append(input, text); list.appendChild(label);
      });
      el("offlineStatus").textContent = `На устройстве: ${cardCount(offlineRecord().cards.length)}. Выбери папки для загрузки.`;
      options.openDialog(el("offlineDialog"));
    }
    async function autoDownload() {
      if (!root.caches || downloading) return;
      const profile = options.getProfile(); const record = offlineRecord(profile);
      if (record.cards.length) {
        const cache = await root.caches.open(cacheName(profile)); const verified = [];
        for (const card of record.cards) {
          if (!card.imageUrl || card.imageUrl.startsWith("data:") || await cache.match(new URL(card.imageUrl, window.location.href).href)) verified.push(card);
        }
        storage.setItem(offlineKey(profile), JSON.stringify({ ...record, cards: verified }));
        if (profile !== options.getProfile()) return;
        render(); if (verified.length) return;
      }
      const cards = options.getCards().filter((card) => /basic-action-/.test(card.id)).slice(0, 20);
      if (!cards.length) return;
      downloading = true; try { await downloadCards(cards, true); } catch { /* Retry remains available from the download screen. */ } finally { downloading = false; }
    }
    function render() {
      options.onStudyView?.(screen === "learn");
      renderThemes(); const summary = options.summary(); const cards = options.getCards();
      el("homeStreak").textContent = summary.streak ? `${summary.streak} дней подряд` : "Новый день — новый шаг";
      el("homeGoalPercent").textContent = `${summary.progress}%`; el("homeGoalButton").style.setProperty("--progress", `${summary.progress * 3.6}deg`);
      el("homeCardCount").textContent = cardCount(cards.length); el("homeReviewedCount").textContent = `${cards.reduce((sum, c) => sum + (c.attempts || 0), 0)} повторений`;
      const favorites = data().favorites.filter((f) => f.active && cards.some((c) => c.id === f.id));
      el("homeFavoriteCount").textContent = cardCount(favorites.length);
      el("homeOfflineCount").textContent = offlineRecord().cards.length ? `${offlineRecord().cards.length} загружено` : "Скачать карточки";
      el("studyOfflineButton").disabled = !offlineRecord().cards.length;
      const card = options.currentCard(); const active = favorites.some((f) => f.id === card?.id);
      el("favoriteCardButton").disabled = !card; el("favoriteCardButton").setAttribute("aria-pressed", String(active));
      el("favoriteCardButton").setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");
      if (screen === "home") renderFolders(); if (screen === "progress") renderProgress(); if (screen === "notes") renderNotes();
    }
    function renderWordChoices() {
      const language = el("noteWordsLanguage").value;
      const query = el("noteWordsSearch").value.trim().toLocaleLowerCase();
      const words = options.getWords(language).filter((word) => `${word.word} ${word.translation || ""}`.toLocaleLowerCase().includes(query));
      const list = el("noteWordChoices"); const scrollTop = list.scrollTop; list.replaceChildren();
      words.slice(0, 100).forEach((word) => {
        const label = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.checked = selectedWords.has(word.word); input.setAttribute("aria-label", word.word);
        input.disabled = !input.checked && selectedWords.size >= 5;
        const text = document.createElement("span"); text.textContent = word.word;
        if (word.translation) { const meaning = document.createElement("small"); meaning.textContent = word.translation; text.appendChild(meaning); }
        label.append(input, text); list.appendChild(label);
        input.addEventListener("change", () => { if (input.checked) selectedWords.add(word.word); else selectedWords.delete(word.word); renderWordChoices(); });
      });
      if (!words.length) { const empty = document.createElement("p"); empty.className = "empty-message"; empty.textContent = query ? "Ничего не найдено" : "В словаре пока нет слов"; list.appendChild(empty); }
      list.scrollTop = scrollTop;
      el("noteWordsCount").textContent = `Выбрано: ${selectedWords.size} из 5${words.length > 100 ? " · Уточни поиск" : ""}`;
      el("createNoteExerciseButton").disabled = !selectedWords.size || noteWordsBusy;
    }
    el("openNoteWordsButton").addEventListener("click", () => {
      if (noteWordsBusy) return;
      noteExerciseEpoch++; flushNote(); selectedWords.clear();
      const languageOption = [...el("noteWordsLanguage").querySelectorAll("option")].find((option) => option.value === options.getLanguage());
      if (languageOption) languageOption.selected = true;
      el("noteWordsSearch").value = ""; el("noteWordsStatus").textContent = "";
      renderWordChoices(); options.openDialog(el("noteWordsDialog"));
    });
    const closeWordPicker = () => { noteExerciseEpoch++; options.closeDialog(el("noteWordsDialog")); };
    el("closeNoteWordsButton").addEventListener("click", closeWordPicker);
    el("noteWordsDialog").addEventListener("cancel", () => { noteExerciseEpoch++; });
    el("noteWordsDialog").addEventListener("click", (event) => { if (event.target === el("noteWordsDialog")) closeWordPicker(); });
    el("noteWordsLanguage").addEventListener("change", () => { selectedWords.clear(); renderWordChoices(); });
    el("noteWordsSearch").addEventListener("input", renderWordChoices);
    el("createNoteExerciseButton").addEventListener("click", async () => {
      if (!selectedWords.size || el("createNoteExerciseButton").disabled) return;
      const profile = options.getProfile();
      const epoch = noteExerciseEpoch;
      noteWordsBusy = true; el("openNoteWordsButton").disabled = true;
      const selected = options.getWords(el("noteWordsLanguage").value).filter((word) => selectedWords.has(word.word));
      for (const id of ["createNoteExerciseButton", "noteWordsLanguage", "noteWordsSearch"]) el(id).disabled = true;
      el("noteWordChoices").inert = true; el("noteWordsStatus").textContent = "DeepSeek составляет и проверяет задание…";
      try {
        await options.onWordsExercise(el("noteWordsLanguage").value, selected, () => epoch === noteExerciseEpoch);
        if (profile !== options.getProfile()) throw new Error("Профиль изменился. Выбери слова заново.");
        options.closeDialog(el("noteWordsDialog")); route("learn");
      } catch (error) { el("noteWordsStatus").textContent = error.message || "Не удалось создать задание. Попробуй ещё раз."; }
      finally { noteWordsBusy = false; el("openNoteWordsButton").disabled = false; el("noteWordChoices").inert = false; for (const id of ["noteWordsLanguage", "noteWordsSearch"]) el(id).disabled = false; renderWordChoices(); }
    });
    el("practiceNoteButton").addEventListener("click", () => {
      const note = data().notes.find((item) => item.id === noteId && !item.deletedAt); if (!note?.body.trim()) return;
      const input = el("noteBody"); const selection = input.value.slice(input.selectionStart, input.selectionEnd);
      flushNote(); options.onNoteText(selection || note.body); route("learn");
    });
    document.querySelectorAll("[data-workspace-route]").forEach((button) => button.addEventListener("click", () => route(button.dataset.workspaceRoute)));
    document.querySelectorAll("[data-progress-days]").forEach((button) => button.addEventListener("click", () => { period = Number(button.dataset.progressDays); document.querySelectorAll("[data-progress-days]").forEach((b) => b.setAttribute("aria-pressed", String(b === button))); renderProgress(); }));
    el("homeGoalButton").addEventListener("click", options.openActivity);
    el("homeDeckButton").addEventListener("click", options.openDeck);
    el("homeFavoritesButton").addEventListener("click", () => { options.onSelection(data().favorites.filter((f) => f.active).map((f) => f.id)); route("learn"); });
    el("studyOfflineButton").addEventListener("click", () => { options.onSelection(offlineRecord().cards.map((c) => c.id)); options.closeDialog(el("offlineDialog")); options.closeDialog(el("settingsDialog")); route("learn"); });
    el("favoriteCardButton").addEventListener("click", () => {
      const card = options.currentCard(); if (!card) return; const next = data(); const old = next.favorites.find((f) => f.id === card.id);
      next.favorites = next.favorites.filter((f) => f.id !== card.id); next.favorites.push({ id: card.id, active: !old?.active, updatedAt: Date.now() }); set(next); render();
    });
    el("noteCardButton").addEventListener("click", () => { const card = options.currentCard(); if (card) newNote(`${card.phrase}\n\n${card.translation || ""}`); });
    el("newNoteButton").addEventListener("click", () => newNote());
    el("noteTitle").addEventListener("input", editNote); el("noteBody").addEventListener("input", editNote); el("notesSearch").addEventListener("input", renderNotes);
    el("deleteNoteButton").addEventListener("click", () => { flushNote(); const next = data(); const note = next.notes.find((n) => n.id === noteId); if (!note) return; note.deletedAt = note.updatedAt = Date.now(); undoId = note.id; noteId = ""; set(next); el("noteEditor").hidden = true; renderNotes(); });
    el("undoNoteButton").addEventListener("click", () => { const next = data(); const note = next.notes.find((n) => n.id === undoId); if (!note) return; note.deletedAt = 0; note.updatedAt = Date.now(); undoId = ""; set(next); openNote(note.id); });
    el("homeOfflineButton").addEventListener("click", openOffline); el("settingsOfflineButton").addEventListener("click", openOffline);
    el("openThemesButton").addEventListener("click", () => options.openDialog(el("themesDialog")));
    el("closeThemesButton").addEventListener("click", () => options.closeDialog(el("themesDialog")));
    el("themesDialog").addEventListener("click", (event) => { if (event.target === el("themesDialog")) options.closeDialog(el("themesDialog")); });
    el("closeOfflineButton").addEventListener("click", () => options.closeDialog(el("offlineDialog")));
    el("offlineDialog").addEventListener("click", (event) => { if (event.target === el("offlineDialog")) options.closeDialog(el("offlineDialog")); });
    el("downloadOfflineButton").addEventListener("click", async () => {
      if (downloading) return; const folders = [...el("offlineFolders").querySelectorAll("input")].filter((i) => i.checked).map((i) => i.value);
      const cards = options.getCards().filter((c) => folders.includes(options.cardFolder(c)));
      if (!cards.length) { el("offlineStatus").textContent = "Выбери папку с карточками."; return; }
      downloading = true; el("downloadOfflineButton").disabled = true;
      try { await downloadCards(cards); } catch { el("offlineStatus").textContent = "Не удалось сохранить загрузку. Проверь свободное место."; }
      finally { downloading = false; el("downloadOfflineButton").disabled = false; }
    });
    el("clearOfflineButton").addEventListener("click", async () => { if (!root.caches || downloading) return; const profile = options.getProfile(); await root.caches.delete(cacheName(profile)); storage.removeItem(offlineKey(profile)); el("offlineStatus").textContent = "Загрузки удалены"; render(); });
    window.addEventListener("pagehide", flushNote);
    return { render, route, autoDownload, downloadCards, openOffline };
  }
  root.MountainWorkspace = { themes, normalize, merge, create };
})(globalThis);

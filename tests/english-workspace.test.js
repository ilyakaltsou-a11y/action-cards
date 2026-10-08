const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { test } = require("node:test");
const { parseHTML } = require("linkedom");
const root = path.resolve(__dirname, "..");
const defaults = JSON.parse(fs.readFileSync(path.join(root, "public/default-cards.json")));

async function launch({ offline = false, saved, storedFolder = "all", exerciseResponse, localStudySettings } = {}) {
  const { document, window } = parseHTML(fs.readFileSync(path.join(root, "public/index.html"), "utf8"));
  const storage = new Map([["action-cards:folder:v1", storedFolder]]);
  if (localStudySettings) storage.set("action-cards:study-settings:v1:deck-workspace-test", JSON.stringify(localStudySettings));
  const localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    key: (index) => [...storage.keys()][index],
    get length() { return storage.size; },
  };
  for (const dialog of document.querySelectorAll("dialog")) {
    Object.defineProperty(dialog, "open", { get: () => dialog.hasAttribute("open") });
    dialog.showModal = () => dialog.setAttribute("open", "");
    dialog.close = () => dialog.removeAttribute("open");
  }
  for (const form of document.querySelectorAll("form")) {
    form.reset = () => {
      for (const input of form.querySelectorAll("input, textarea")) {
        if (input.type === "radio" || input.type === "checkbox") input.checked = input.hasAttribute("checked");
        else input.value = input.getAttribute("value") || "";
      }
    };
  }
  window.location = new URL("http://localhost/?profile=deck-workspace-test");
  window.history = { replaceState: () => {} };
  window.setTimeout = (callback) => { callback(); return 0; };
  window.clearTimeout = () => {};
  const listeners = [];
  const addWindowListener = window.addEventListener.bind(window);
  window.addEventListener = (type, listener, options) => {
    listeners.push({ type, options });
    addWindowListener(type, listener, options);
  };
  const flashcard = document.getElementById("flashcard");
  const addCardListener = flashcard.addEventListener.bind(flashcard);
  flashcard.addEventListener = (type, listener, options) => {
    listeners.push({ type, options, target: "card" });
    addCardListener(type, listener, options);
  };
  let capturedPointer = null;
  flashcard.setPointerCapture = (id) => { capturedPointer = id; };
  flashcard.hasPointerCapture = (id) => capturedPointer === id;
  flashcard.releasePointerCapture = (id) => {
    capturedPointer = null;
    const event = new window.Event("lostpointercapture", { bubbles: true });
    event.pointerId = id;
    flashcard.dispatchEvent(event);
  };
  document.cookie = "";
  let remote = saved || { cards: defaults.cards.slice(0, 30), starterPacks: [] };
  const requests = [];
  let exerciseCalls = 0;
  const fetch = async (url, options = {}) => {
    const route = String(url);
    requests.push({ route, body: options.body && JSON.parse(options.body) });
    if (route.includes("default-cards.json")) return { ok: true, json: async () => structuredClone(defaults) };
    if (offline) throw new Error("Server unavailable");
    if (route.includes("/api/status")) return { ok: true, json: async () => ({ aiReady: true, deepSeekReady: true }) };
    if (route === "/api/create-card") {
      const body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ word: body.word, phrase: "I carry the bag.", translation: "Я несу сумку.", imageUrl: defaults.cards[0].imageUrl }) };
    }
    if (route === "/api/english/sentence-trainer/create-exercise") {
      const body = JSON.parse(options.body);
      exerciseCalls += 1;
      const exercise = exerciseResponse ? exerciseResponse(body, exerciseCalls) : { promptRu: "Подними телефон.", expectedEn: "Pick up the phone.", usedWords: body.focusWords };
      return { ok: true, json: async () => ({ exercise }) };
    }
    if (route === "/api/english/sentence-trainer/check-answer") {
      return { ok: true, json: async () => ({ isCorrect: true, correctedAnswer: "Pick up the phone.", score: 100 }) };
    }
    if (route.includes("prepare-manual")) {
      const body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ exercise: { promptRu: body.promptRu, expectedEn: "I carry the bag.", hint: "Используй настоящее время.", usedWords: ["carry", "bag"] } }) };
    }
    if (options.method === "PUT") {
      remote = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => structuredClone(remote) };
  };
  const sandbox = {
    window, document, localStorage, fetch, URL, AbortController,
    crypto: require("node:crypto").webcrypto, navigator: { language: "ru" },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, confirm: () => true, console,
  };
  let clockOffset = 0;
  sandbox.Date = class extends Date {
    static now() { return Date.now() + clockOffset; }
  };
  vm.createContext(sandbox);
  for (const script of document.querySelectorAll("script[src]")) {
    const file = script.getAttribute("src").split("?")[0];
    const testApi = file === "app.js" ? "\nglobalThis.testApi = { state, swipes, activityTracker, renderStudy, loadServerCards, saveCards, startEditCard, currentCard, englishTrainerWords, mergeEnglishTrainerWords, renderEnglishTrainer, removeEnglishTrainerWord, boostEnglishTrainerWord, englishTrainerVocabularyForExercise, fetchEnglishTrainerExercise, englishExerciseTextsMatch, normalizeEnglishTrainerState, mergeEnglishTrainerState, renameFolder, deleteFolder };" : "";
    vm.runInContext(fs.readFileSync(path.join(root, "public", file), "utf8") + testApi, sandbox, { filename: file });
  }
  const flush = async () => { for (let index = 0; index < 10; index += 1) await new Promise(setImmediate); };
  await flush();
  document.querySelector('[data-goal-mode="medium"]').click();
  return { document, window, state: sandbox.testApi.state, swipe: sandbox.testApi.swipes, api: sandbox.testApi, requests, listeners, flush, advanceTime: (milliseconds) => { clockOffset += milliseconds; }, getSaved: () => remote };
}

function pointer(app, type, x, y, overrides = {}, target = app.document.getElementById("flashcard")) {
  const event = new app.window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, clientX: x, clientY: y, pointerType: "mouse", button: 0, isPrimary: true }, overrides);
  target.dispatchEvent(event);
  return event;
}

function touch(app, type, x, y, options = {}) {
  const point = { identifier: 7, clientX: x, clientY: y };
  const event = new app.window.Event(type, { bubbles: true, cancelable: options.cancelable !== false });
  Object.assign(event, {
    touches: options.touches || (type === "touchend" || type === "touchcancel" ? [] : [point]),
    changedTouches: options.changedTouches || [point],
  });
  (options.target || app.document.getElementById("flashcard")).dispatchEvent(event);
  return event;
}

function choosePracticeCheckbox(app, selector, value, checked) {
  const input = [...app.document.querySelectorAll(`${selector} input`)].find((item) => item.value === value);
  assert.ok(input, `Checkbox ${value} is present`);
  input.checked = checked;
  input.dispatchEvent(new app.window.Event("change", { bubbles: true }));
}

test("practice selection combines folders and individual cards without changing the library", async () => {
  const app = await launch();
  const doc = app.document;
  const originalCount = app.state.cards.length;
  const ids = [app.state.cards.find((card) => card.id.startsWith("basic-question-001")).id,
    app.state.cards.find((card) => card.id.startsWith("basic-action-001")).id];
  doc.getElementById("openStudyFoldersButton").click();
  choosePracticeCheckbox(app, "#practiceFolderChoices", "all", false);
  assert.equal(doc.getElementById("applyPracticeSelectionButton").disabled, true);
  choosePracticeCheckbox(app, "#practiceFolderChoices", "Стартовые / Вопросы", true);
  choosePracticeCheckbox(app, "#practiceFolderChoices", "Стартовые / Действия с предметами", true);
  assert.equal(doc.querySelectorAll("#practiceCardChoices input").length, 32);
  doc.getElementById("clearPracticeCardsButton").click();
  for (const id of ids) choosePracticeCheckbox(app, "#practiceCardChoices", id, true);
  doc.getElementById("applyPracticeSelectionButton").click();
  assert.equal(doc.getElementById("practiceSelectionDialog").open, false);
  assert.equal(app.state.cards.length, originalCount);
  assert.deepEqual(Array.from(app.state.studySettings.selection.cardIds).sort(), ids.sort());
  assert.equal(doc.querySelectorAll("#deckList .deck-item").length, originalCount);
  const reviewed = app.api.currentCard();
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 240, 110);
  touch(app, "touchend", 240, 110);
  assert.equal(reviewed.attempts, 1);
  assert.ok(ids.includes(app.api.currentCard().id));
  assert.notEqual(app.api.currentCard().id, reviewed.id);
  doc.querySelector('[data-study-mode="russian"]').click();
  await app.flush();
  assert.equal(app.getSaved().studySettings.selection.cardIds.length, 2);
  const reloaded = await launch({ saved: app.getSaved() });
  assert.deepEqual(Array.from(reloaded.state.studySettings.selection.cardIds).sort(), ids.sort());
  assert.ok(ids.includes(reloaded.api.currentCard().id));
  assert.equal(reloaded.state.studySettings.mode, "russian");
});

test("cancel, empty selection, search and select-all never silently alter saved practice", async () => {
  const app = await launch();
  const doc = app.document;
  doc.getElementById("openStudyFoldersButton").click();
  doc.getElementById("clearPracticeCardsButton").click();
  assert.equal(doc.getElementById("applyPracticeSelectionButton").disabled, true);
  doc.getElementById("applyPracticeSelectionButton").click();
  assert.equal(doc.getElementById("practiceSelectionDialog").open, true);
  doc.getElementById("closePracticeSelectionButton").click();
  assert.equal(app.state.studySettings.selection, undefined);
  doc.getElementById("openStudyFoldersButton").click();
  const input = doc.getElementById("practiceCardSearch");
  input.value = "Можешь поднести";
  input.dispatchEvent(new app.window.Event("input", { bubbles: true }));
  assert.equal(doc.querySelectorAll("#practiceCardChoices input").length, 1);
  const first = doc.querySelector("#practiceCardChoices input");
  choosePracticeCheckbox(app, "#practiceCardChoices", first.value, false);
  input.value = "no-match-at-all";
  input.dispatchEvent(new app.window.Event("input", { bubbles: true }));
  assert.equal(doc.querySelectorAll("#practiceCardChoices input").length, 0);
  assert.equal(doc.getElementById("applyPracticeSelectionButton").disabled, false);
  doc.getElementById("selectAllPracticeCardsButton").click();
  doc.getElementById("applyPracticeSelectionButton").click();
  assert.equal(app.state.studySettings.selection.cardIds, null);
  assert.deepEqual(Array.from(app.state.studySettings.selection.folderPaths), ["all"]);
});

test("sentence generation receives only selected card examples, even when siblings share a keyword", async () => {
  const app = await launch({ exerciseResponse: (body) => ({ promptRu: "Сначала подними телефон, затем поднеси его ближе.", expectedEn: "Pick up the phone and bring it closer.", usedWords: body.focusWords }) });
  const doc = app.document;
  const selected = app.state.cards.find((card) => card.word === "pick up");
  const second = app.state.cards.find((card) => card.word === "bring closer");
  app.state.cards.push({ ...selected, id: "same-word-unselected", phrase: "Pick up the suitcase." });
  doc.getElementById("englishSentencesTab").click();
  doc.getElementById("openTrainerCardSelectionButton").click();
  choosePracticeCheckbox(app, "#practiceFolderChoices", "all", false);
  choosePracticeCheckbox(app, "#practiceFolderChoices", "Стартовые / Действия с предметами", true);
  doc.getElementById("clearPracticeCardsButton").click();
  for (const card of [selected, second]) choosePracticeCheckbox(app, "#practiceCardChoices", card.id, true);
  doc.getElementById("applyPracticeSelectionButton").click();
  doc.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  const request = app.requests.find((item) => item.route.includes("sentence-trainer/create-exercise"));
  assert.ok(request);
  assert.deepEqual(request.body.sourceCards.map((card) => card.phrase).sort(), [selected.phrase, second.phrase].sort());
  assert.deepEqual(request.body.words.map((word) => word.word).sort(), ["bring closer", "pick up"]);
  assert.ok(app.api.englishTrainerWords().length > 2);
  assert.equal(app.state.studySettings.selection, undefined);
  const reloaded = await launch({ saved: app.getSaved() });
  assert.deepEqual(Array.from(reloaded.state.englishTrainer.cardIds).sort(), [selected.id, second.id].sort());
  assert.equal(reloaded.api.englishTrainerVocabularyForExercise().length, 2);
});

test("all-folder sentence practice still restricts examples and vocabulary to explicitly selected cards", async () => {
  const app = await launch({ exerciseResponse: (body) => ({ promptRu: "Подними телефон и поднеси его ближе.", expectedEn: "Pick up the phone and bring it closer.", usedWords: body.focusWords }) });
  const doc = app.document;
  const cards = app.state.cards.filter((card) => ["pick up", "bring closer"].includes(card.word));
  doc.getElementById("englishSentencesTab").click();
  doc.getElementById("openTrainerCardSelectionButton").click();
  doc.getElementById("clearPracticeCardsButton").click();
  for (const card of cards) choosePracticeCheckbox(app, "#practiceCardChoices", card.id, true);
  doc.getElementById("applyPracticeSelectionButton").click();
  assert.deepEqual(Array.from(app.state.englishTrainer.folderPaths), ["all"]);
  doc.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  const request = app.requests.find((item) => item.route.includes("sentence-trainer/create-exercise"));
  assert.ok(request);
  assert.deepEqual(request.body.sourceCards.map((card) => card.phrase).sort(), Array.from(cards, (card) => card.phrase).sort());
  assert.deepEqual(request.body.words.map((word) => word.word).sort(), ["bring closer", "pick up"]);
});

test("practice picker handles thousands of cards with bounded rendering and stable search selection", async () => {
  const app = await launch();
  app.state.cards = Array.from({ length: 1200 }, (_, index) => ({ ...app.state.cards[0], id: `large-${index}`, phrase: `Example ${index}`, folderPath: "Large" }));
  app.state.activeFolder = "all";
  const doc = app.document;
  doc.getElementById("openStudyFoldersButton").click();
  assert.equal(doc.querySelectorAll("#practiceCardChoices input").length, 100);
  assert.equal(doc.getElementById("morePracticeCardsButton").hidden, false);
  doc.getElementById("morePracticeCardsButton").click();
  assert.equal(doc.querySelectorAll("#practiceCardChoices input").length, 200);
  doc.getElementById("clearPracticeCardsButton").click();
  doc.getElementById("practiceCardSearch").value = "Example 1199";
  doc.getElementById("practiceCardSearch").dispatchEvent(new app.window.Event("input", { bubbles: true }));
  choosePracticeCheckbox(app, "#practiceCardChoices", "large-1199", true);
  doc.getElementById("applyPracticeSelectionButton").click();
  assert.deepEqual(Array.from(app.state.studySettings.selection.cardIds), ["large-1199"]);
  assert.equal(app.api.currentCard().id, "large-1199");
});

test("selected practice folders follow rename and deletion without falling back to unrelated cards", async () => {
  const app = await launch();
  app.state.studySettings.selection = { folderPaths: ["Стартовые / Вопросы"], cardIds: null };
  app.api.renameFolder("Стартовые / Вопросы", "Стартовые / Просьбы");
  assert.deepEqual(Array.from(app.state.studySettings.selection.folderPaths), ["Стартовые / Просьбы"]);
  assert.ok(app.api.currentCard());
  app.api.deleteFolder("Стартовые / Просьбы");
  assert.equal(app.api.currentCard(), null);
  assert.equal(app.state.cards.length, 50);
});

test("newest sentence folder and card selection wins as one unit during profile merge", async () => {
  const app = await launch();
  const merged = app.api.mergeEnglishTrainerState(
    { folderPaths: ["Home"], cardIds: ["home-1"], folderUpdatedAt: 50 },
    { folderPaths: ["Actions"], cardIds: ["action-1"], folderUpdatedAt: 100 });
  assert.deepEqual(Array.from(merged.folderPaths), ["Actions"]);
  assert.deepEqual(Array.from(merged.cardIds), ["action-1"]);
  const cleared = app.api.mergeEnglishTrainerState(merged, { folderPaths: ["all"], cardIds: null, folderUpdatedAt: 200 });
  assert.equal(cleared.cardIds, null);
  assert.deepEqual(Array.from(cleared.folderPaths), ["all"]);
});

test("complete app startup adds basic action and question cards to an existing profile once", async () => {
  const app = await launch();
  assert.equal(app.state.cards.length, 62);
  assert.equal(app.state.cards.filter((card) => card.id.startsWith("basic-action-")).length, 20);
  assert.equal(app.state.cards.filter((card) => card.id.startsWith("basic-question-")).length, 12);
  await app.api.loadServerCards();
  assert.equal(app.state.cards.length, 62);
  const ids = [...app.document.querySelectorAll("[id]")].map((element) => element.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("starter pack loads with the sync server unavailable and a stale folder selection", async () => {
  const app = await launch({ offline: true, storedFolder: "Deleted folder" });
  assert.equal(app.state.cards.length, 62);
  assert.equal(app.state.activeFolder, "all");
  assert.ok(app.document.querySelector("#cardImage").style.backgroundImage);
});

test("toolbar opens creation, songs, deck and dictionary in separate dialogs", async () => {
  const app = await launch();
  assert.equal(app.document.querySelector("#englishSentencesPractice").hidden, true);
  for (const [open, dialog, close] of [
    ["openCreatorButton", "cardCreatorDialog", "closeCreatorButton"],
    ["openSongButton", "songDialog", "closeSongButton"],
    ["openDeckButton", "deckDialog", "closeDeckButton"],
    ["openEnglishTrainerDictionaryButton", "englishTrainerDictionaryDialog", "closeEnglishTrainerDictionaryButton"],
  ]) {
    app.document.getElementById(open).click();
    assert.equal(app.document.getElementById(dialog).open, true);
    app.document.getElementById(close).click();
    assert.equal(app.document.getElementById(dialog).open, false);
  }
  assert.ok(app.document.querySelector("#folderTree").closest("#deckDialog"));
  assert.ok(app.document.querySelector("#englishTrainerWordsInput").closest("#englishTrainerDictionaryDialog"));
});

test("basic practice selects the folder and every action has its motion symbol", async () => {
  const app = await launch();
  app.document.querySelector("#startBasicActionsButton").click();
  await app.flush();
  assert.equal(app.state.activeFolder, "Стартовые / Действия с предметами");
  assert.equal(app.state.cards.length, 62);
  for (let index = 0; index < 20; index += 1) {
    app.api.renderStudy(index);
    assert.equal(app.document.querySelector("#cardMotion").hidden, false);
  }
  const down = app.state.cards.filter((card) => card.folderPath === app.state.activeFolder).findIndex((card) => card.phrase === "Put the cup down on the table.");
  app.api.renderStudy(down);
  assert.equal(app.document.querySelector("#cardMotionIcon").getAttribute("href"), "assets/icons.svg#arrow-down");
});

test("creating and editing a card work after moving the form into a dialog", async () => {
  const app = await launch();
  app.document.querySelector("#openCreatorButton").click();
  app.document.querySelector("#wordInput").value = "carry";
  app.document.querySelector("#generateButton").dispatchEvent(new app.document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
  await app.flush();
  assert.equal(app.document.querySelector("#draftCard").hidden, false);
  app.document.querySelector("#saveDraftButton").click();
  assert.equal(app.state.cards.length, 63);
  assert.equal(app.document.querySelector("#cardCreatorDialog").open, false);
  app.document.querySelector("#openDeckButton").click();
  app.document.querySelector(".edit-card-button").click();
  assert.equal(app.document.querySelector("#deckDialog").open, false);
  assert.equal(app.document.querySelector("#cardCreatorDialog").open, true);
  assert.equal(app.document.querySelector("#manualPhraseInput").value.length > 0, true);
});

test("sentence practice and manual-text hints remain available", async () => {
  const app = await launch();
  app.document.querySelector("#englishSentencesTab").click();
  assert.equal(app.document.querySelector("#englishCardsPractice").hidden, true);
  assert.equal(app.document.querySelector("#englishSentencesPractice").hidden, false);
  app.document.querySelector("#openEnglishTrainerTextButton").click();
  app.document.querySelector("#englishTrainerManualPromptInput").value = "Я несу сумку.";
  app.document.querySelector("#startEnglishTrainerManualPromptButton").click();
  await app.flush();
  assert.equal(app.document.querySelector("#englishTrainerExerciseCard").hidden, false);
  assert.ok(app.document.querySelector("#englishTrainerExerciseHint").textContent.includes("настоящее"));
  assert.equal(app.document.querySelector("#englishTrainerExerciseHint").classList.contains("is-hidden"), false);
  app.document.querySelector("#englishCardsTab").click();
  assert.equal(app.document.querySelector("#englishCardsPractice").hidden, false);
});

test("deleted basic cards stay deleted after reload", async () => {
  const app = await launch();
  const removed = app.state.cards.find((card) => card.id.startsWith("basic-action-"));
  app.state.cards = app.state.cards.filter((card) => card.id !== removed.id);
  app.api.saveCards();
  await app.flush();
  await app.api.loadServerCards();
  assert.equal(app.state.cards.length, 61);
  assert.equal(app.state.cards.some((card) => card.id === removed.id), false);
});

test("the question starter pack upgrades existing profiles, preserves progress and stays deleted when removed", async () => {
  const oldCards = defaults.cards.filter((card) => !card.id.startsWith("basic-question-"));
  const existingCard = { ...oldCards[0], id: "my-existing-card", attempts: 8, correct: 6, level: 3 };
  const app = await launch({ saved: { cards: [existingCard], starterPacks: ["basic-actions-v1"] } });
  const questions = app.state.cards.filter((card) => card.folderPath === "Стартовые / Вопросы");
  assert.equal(questions.length, 12);
  assert.ok(questions.every((card) => card.textOnly && !card.imageUrl && card.patternTranslation));
  assert.equal(app.state.cards.find((card) => card.id === existingCard.id).attempts, 8);
  assert.equal(app.state.cards.find((card) => card.id === existingCard.id).level, 3);
  assert.ok(app.state.starterPacks.includes("basic-questions-v1"));
  const translated = app.api.englishTrainerWords("Стартовые / Вопросы");
  assert.equal(translated.length, 12);
  assert.ok(translated.every((word) => word.translation));
  assert.ok(translated.some((word) => word.word === "would you mind"));
  app.state.cards = app.state.cards.filter((card) => card.id !== questions[0].id);
  app.api.saveCards();
  await app.flush();
  const reloaded = await launch({ saved: app.getSaved() });
  assert.equal(reloaded.state.cards.filter((card) => card.id.startsWith("basic-question-")).length, 11);
  reloaded.document.getElementById("startBasicActionsButton").click();
  await reloaded.flush();
  assert.equal(reloaded.state.cards.filter((card) => card.id.startsWith("basic-question-")).length, 11);
});

test("question starter examples do not duplicate matching personal cards", async () => {
  const personal = { ...defaults.cards.find((card) => card.id === "basic-question-001"), id: "my-question", folderPath: "Personal", attempts: 4 };
  const app = await launch({ saved: { cards: [personal], starterPacks: ["basic-actions-v1"] } });
  assert.equal(app.state.cards.filter((card) => card.phrase === personal.phrase).length, 1);
  assert.equal(app.state.cards.find((card) => card.id === "my-question").attempts, 4);
  assert.equal(app.state.cards.filter((card) => card.id.startsWith("basic-question-")).length, 11);
});

test("picture mode retains the picture, English answer and independently revealed translation", async () => {
  const app = await launch();
  const doc = app.document;
  assert.equal(app.state.studySettings.mode, "picture");
  assert.equal(doc.querySelector('[data-study-mode="picture"]').getAttribute("aria-pressed"), "true");
  assert.equal(doc.getElementById("cardImage").hidden, false);
  assert.equal(doc.getElementById("cardRussianPrompt").hidden, true);
  assert.equal(doc.getElementById("cardAnswerImage").hidden, true);
  assert.equal(doc.getElementById("cardBack").getAttribute("aria-hidden"), "true");
  doc.getElementById("flashcard").click();
  assert.equal(app.state.flipped, true);
  assert.equal(doc.getElementById("cardBack").hasAttribute("inert"), false);
  assert.equal(doc.getElementById("cardTranslation").hidden, false);
  assert.equal(doc.getElementById("cardTranslation").classList.contains("is-hidden"), true);
  doc.getElementById("cardTranslation").click();
  assert.equal(doc.querySelector("#cardTranslation .translation-text").textContent, app.api.currentCard().translation);
  assert.equal(doc.getElementById("cardTranslation").classList.contains("is-hidden"), false);
  assert.equal(app.state.flipped, true);
});

test("text-only questions show Russian first, English and a construction on flip, and support swipes", async () => {
  const app = await launch();
  const doc = app.document;
  app.state.activeFolder = "Стартовые / Вопросы";
  app.api.renderStudy(0);
  const card = app.api.currentCard();
  assert.equal(card.textOnly, true);
  assert.equal(app.state.studySettings.mode, "picture");
  assert.equal(doc.getElementById("cardImage").hidden, true);
  assert.equal(doc.querySelector('[data-study-mode="picture"]').disabled, true);
  assert.equal(doc.querySelector('[data-study-mode="russian"]').getAttribute("aria-pressed"), "true");
  assert.equal(doc.getElementById("cardRussianPrompt").hidden, false);
  assert.equal(doc.getElementById("cardRussianPrompt").textContent, card.translation);
  assert.equal(doc.getElementById("cardAnswerImage").hidden, true);
  assert.equal(doc.getElementById("cardTranslation").hidden, true);
  doc.getElementById("flashcard").click();
  assert.equal(app.state.flipped, true);
  assert.equal(doc.getElementById("cardPhrase").textContent, card.phrase);
  assert.equal(doc.getElementById("cardPattern").hidden, false);
  assert.equal(doc.getElementById("cardPattern").textContent, `${card.word} — ${card.patternTranslation}`);
  assert.equal(doc.getElementById("flashcard").getAttribute("aria-label"), "Показать русский текст");
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 220, 120);
  touch(app, "touchend", 220, 120);
  assert.equal(card.attempts, 1);
  assert.notEqual(app.api.currentCard().id, card.id);
  assert.equal(doc.getElementById("cardImage").hidden, true);
  await app.flush();
  const restarted = await launch({ saved: app.getSaved() });
  assert.equal(restarted.state.cards.find((item) => item.id === card.id).textOnly, true);
  app.state.activeFolder = "Стартовые / Действия с предметами";
  app.api.renderStudy(0);
  assert.equal(doc.getElementById("cardImage").hidden, false);
  assert.equal(doc.getElementById("cardPattern").hidden, true);
  assert.equal(doc.querySelector('[data-study-mode="picture"]').disabled, false);
  assert.equal(app.requests.filter((item) => item.route.startsWith("/api/create")).length, 0);
});

test("Russian mode starts with Russian and flips to English with a small existing image", async () => {
  const app = await launch();
  const doc = app.document;
  const card = app.api.currentCard();
  const order = app.state.cards.map((item) => item.id).join();
  const attempts = card.attempts;
  const reviews = app.state.activity.totalReviews;
  doc.querySelector('[data-study-mode="russian"]').click();
  assert.equal(app.state.flipped, false);
  assert.equal(doc.getElementById("cardRussianPrompt").textContent, card.translation);
  assert.equal(doc.getElementById("cardRussianPrompt").hidden, false);
  assert.equal(doc.getElementById("cardImage").hidden, true);
  assert.equal(doc.getElementById("cardMotion").hidden, true);
  assert.equal(doc.getElementById("cardBack").getAttribute("aria-hidden"), "true");
  assert.equal(doc.getElementById("cardBack").hasAttribute("inert"), true);
  doc.getElementById("flashcard").click();
  assert.equal(app.state.flipped, true);
  assert.equal(doc.getElementById("cardFront").hasAttribute("inert"), true);
  assert.equal(doc.getElementById("cardBack").getAttribute("aria-hidden"), "false");
  assert.equal(doc.getElementById("cardPhrase").textContent, card.phrase);
  assert.equal(doc.getElementById("cardAnswerImage").hidden, false);
  assert.ok(doc.getElementById("cardAnswerImage").style.backgroundImage.includes(card.imageUrl));
  assert.equal(doc.getElementById("cardTranslation").hidden, true);
  doc.getElementById("listenCardButton").click();
  assert.equal(app.state.flipped, true);
  assert.equal(app.state.cards.map((item) => item.id).join(), order);
  assert.equal(card.attempts, attempts);
  assert.equal(app.state.activity.totalReviews, reviews);
  assert.equal(app.requests.filter((item) => item.route.startsWith("/api/create")).length, 0);
  await app.flush();
  assert.equal(app.getSaved().studySettings.mode, "russian");
  const restarted = await launch({ saved: app.getSaved() });
  assert.equal(restarted.state.studySettings.mode, "russian");
  assert.equal(restarted.document.getElementById("cardRussianPrompt").hidden, false);
});

test("Russian-mode swipes rate exactly once and keep the next card in the chosen mode", async () => {
  const app = await launch();
  const doc = app.document;
  doc.querySelector('[data-study-mode="russian"]').click();
  const card = app.api.currentCard();
  const attempts = card.attempts;
  doc.getElementById("flashcard").click();
  touch(app, "touchstart", 100, 100, { target: doc.getElementById("cardPhrase") });
  touch(app, "touchmove", 220, 140, { target: doc.getElementById("cardPhrase") });
  touch(app, "touchend", 220, 140, { target: doc.getElementById("cardPhrase") });
  assert.equal(card.attempts, attempts + 1);
  assert.notEqual(app.api.currentCard().id, card.id);
  assert.equal(app.state.flipped, false);
  assert.equal(app.state.studySettings.mode, "russian");
  assert.equal(doc.getElementById("cardRussianPrompt").textContent, app.api.currentCard().translation);
  doc.querySelector('[data-study-mode="picture"]').click();
  assert.equal(app.state.flipped, false);
  assert.equal(doc.getElementById("cardImage").hidden, false);
  assert.equal(doc.getElementById("cardRussianPrompt").hidden, true);
  assert.equal(doc.getElementById("cardAnswerImage").hidden, true);
  assert.equal(doc.getElementById("cardTranslation").classList.contains("is-hidden"), true);
});

test("study mode chooses the newest local or remote preference and defaults safely for old profiles", async () => {
  for (const [local, remote, expected] of [
    [{ mode: "russian", updatedAt: 20 }, { mode: "picture", updatedAt: 10 }, "russian"],
    [{ mode: "picture", updatedAt: 10 }, { mode: "russian", updatedAt: 20 }, "russian"],
    [{ mode: "russian", updatedAt: 10 }, { mode: "picture", updatedAt: 20 }, "picture"],
    [{ mode: "unknown", updatedAt: -10 }, null, "picture"],
  ]) {
    const app = await launch({ localStudySettings: local, saved: { cards: defaults.cards, studySettings: remote } });
    assert.equal(app.state.studySettings.mode, expected);
  }
});

test("study mode survives offline reload and is isolated between profiles", async () => {
  const localStudySettings = { mode: "russian", updatedAt: 20 };
  const app = await launch({ offline: true, localStudySettings });
  assert.equal(app.state.studySettings.mode, "russian");
  app.document.getElementById("newProfileButton").click();
  await app.flush();
  assert.equal(app.state.studySettings.mode, "picture");
  app.document.getElementById("profileInput").value = "deck-workspace-test";
  app.document.getElementById("loadProfileButton").click();
  await app.flush();
  assert.equal(app.state.studySettings.mode, "russian");
});

test("Russian mode handles cards without translations or images and an empty deck without leaking English", async () => {
  const app = await launch();
  const doc = app.document;
  const card = app.api.currentCard();
  card.translation = " ";
  card.imageUrl = "";
  doc.querySelector('[data-study-mode="russian"]').click();
  assert.equal(doc.getElementById("cardRussianPrompt").textContent, "У этой карточки пока нет русского перевода.");
  assert.equal(doc.getElementById("cardAnswerImage").hidden, true);
  assert.equal(doc.getElementById("cardBack").hasAttribute("inert"), true);
  app.state.cards = [];
  app.api.renderStudy();
  assert.equal(doc.getElementById("cardRussianPrompt").textContent, "Добавь карточку для тренировки.");
  doc.getElementById("flashcard").click();
  assert.equal(app.state.flipped, false);
});

test("first mouse drag captures the card, shows green feedback and rates exactly once", async () => {
  const app = await launch();
  const element = app.document.getElementById("flashcard");
  const card = app.api.currentCard();
  const attempts = card.attempts;
  const correct = card.correct;
  assert.equal(pointer(app, "pointerdown", 100, 100).defaultPrevented, true);
  assert.equal(element.hasPointerCapture(1), true);
  assert.equal(pointer(app, "pointermove", 220, 105, {}, app.window).defaultPrevented, true);
  assert.equal(app.swipe.gesture.active, true);
  assert.equal(Number(element.style.getPropertyValue("--swipe-right-opacity")), 1);
  pointer(app, "pointerup", 220, 105);
  assert.equal(app.swipe.gesture, null);
  assert.equal(element.hasPointerCapture(1), false);
  assert.equal(card.attempts, attempts + 1);
  assert.equal(card.correct, correct + 1);
  assert.equal(app.state.cards.at(-1).id, card.id);
  element.click();
  assert.equal(app.state.flipped, false);
  assert.equal(element.style.transform, "");
});

test("touch swipe shows red feedback and moves an unknown card nearer the top", async () => {
  const app = await launch();
  const card = app.api.currentCard();
  const attempts = card.attempts;
  const correct = card.correct;
  touch(app, "touchstart", 200, 100);
  assert.equal(touch(app, "touchmove", 80, 110).defaultPrevented, true);
  assert.equal(Number(app.document.getElementById("flashcard").style.getPropertyValue("--swipe-left-opacity")), 1);
  touch(app, "touchend", 80, 110);
  assert.equal(card.attempts, attempts + 1);
  assert.equal(card.correct, correct);
  const position = app.state.cards.findIndex((item) => item.id === card.id);
  assert.ok(position > 0 && position < app.state.cards.length / 2);
});

test("vertical touch motion leaves native page scrolling available without rating or flipping", async () => {
  const app = await launch();
  const card = app.api.currentCard();
  const attempts = card.attempts;
  touch(app, "touchstart", 100, 100);
  assert.equal(touch(app, "touchmove", 103, 200).defaultPrevented, false);
  assert.equal(app.swipe.gesture.axis, "y");
  assert.equal(touch(app, "touchmove", 230, 210).defaultPrevented, false);
  assert.equal(app.swipe.gesture.active, false);
  assert.equal(app.document.getElementById("flashcard").style.transform || "", "");
  touch(app, "touchend", 230, 210);
  assert.equal(card.attempts, attempts);
  app.document.getElementById("flashcard").click();
  assert.equal(app.state.flipped, false);
  app.advanceTime(500);
  pointer(app, "pointerdown", 100, 100);
  pointer(app, "pointerup", 100, 100);
  app.document.getElementById("flashcard").click();
  assert.equal(app.state.flipped, true);
  for (const id of ["listenCardButton", "cardTranslation"]) {
    pointer(app, "pointerdown", 100, 100, {}, app.document.getElementById(id));
    assert.equal(app.swipe.gesture, null);
  }
  pointer(app, "pointerdown", 100, 100, { button: 2 });
  assert.equal(app.swipe.gesture, null);
  pointer(app, "pointerdown", 100, 100, { isPrimary: false });
  assert.equal(app.swipe.gesture, null);
});

test("touch swipes work on the first attempt after vertical jitter in either direction", async () => {
  const app = await launch();
  const element = app.document.getElementById("flashcard");
  for (const direction of [-1, 1]) {
    const card = app.api.currentCard();
    const attempts = card.attempts;
    const correct = card.correct;
    touch(app, "touchstart", 200, 200);
    touch(app, "touchmove", 201, 203);
    assert.equal(app.swipe.gesture.active, false);
    assert.equal(element.hasPointerCapture(1), false);
    assert.equal(touch(app, "touchmove", 200 + direction * 20, 210).defaultPrevented, true);
    assert.equal(app.swipe.gesture.axis, "x");
    assert.equal(touch(app, "touchmove", 200 + direction * 120, 500).defaultPrevented, true);
    assert.equal(app.swipe.gesture.active, true);
    assert.ok(element.style.transform.includes(`translateX(${direction * 120}px)`));
    touch(app, "touchend", 200 + direction * 120, 500);
    assert.equal(card.attempts, attempts + 1);
    assert.equal(card.correct, correct + (direction > 0 ? 1 : 0));
  }
  assert.equal(touch(app, "touchmove", 200, 300, { target: app.window }).defaultPrevented, false);
  const css = fs.readFileSync(path.join(root, "public/styles.css"), "utf8");
  assert.match(css, /\.flashcard\s*\{[^}]*touch-action:\s*pan-y pinch-zoom\s*;/);
  assert.equal(app.listeners.find((listener) => listener.type === "touchmove").options.passive, false);
  assert.equal(app.listeners.find((listener) => listener.type === "touchmove").target, "card");
});

test("a touch swipe survives compatibility pointer cancellation and is rated only on touchend", async () => {
  const app = await launch();
  const card = app.api.currentCard();
  const attempts = card.attempts;
  pointer(app, "pointerdown", 100, 100, { pointerType: "touch" });
  assert.equal(app.swipe.gesture, null);
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 125, 104);
  for (const type of ["pointercancel", "lostpointercapture", "pointerup"]) {
    pointer(app, type, 230, 200, { pointerType: "touch" });
    assert.equal(app.swipe.gesture.axis, "x");
    assert.equal(card.attempts, attempts);
  }
  touch(app, "touchmove", 230, 200);
  touch(app, "touchend", 230, 200);
  touch(app, "touchend", 230, 200);
  assert.equal(card.attempts, attempts + 1);
  app.document.getElementById("flashcard").click();
  assert.equal(app.state.flipped, false);
});

test("touch cancellation, multitouch and window blur clear the gesture without rating", async () => {
  const app = await launch();
  const element = app.document.getElementById("flashcard");
  const card = app.api.currentCard();
  const attempts = card.attempts;
  for (const reason of ["cancel", "multitouch", "blur"]) {
    touch(app, "touchstart", 100, 100);
    touch(app, "touchmove", 230, 110);
    if (reason === "cancel") touch(app, "touchcancel", 230, 110);
    if (reason === "blur") app.window.dispatchEvent(new app.window.Event("blur"));
    if (reason === "multitouch") touch(app, "touchstart", 230, 110, {
      target: app.window,
      touches: [{ identifier: 7, clientX: 230, clientY: 110 }, { identifier: 8, clientX: 300, clientY: 110 }],
    });
    assert.equal(app.swipe.gesture, null);
    assert.equal(element.style.transform, "");
    touch(app, "touchend", 230, 110);
    assert.equal(card.attempts, attempts);
  }
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 230, 110);
  touch(app, "touchend", 230, 110);
  assert.equal(card.attempts, attempts + 1);
});

test("touch taps still flip the card and listening or translation controls never start a swipe", async () => {
  const app = await launch();
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 101, 102);
  touch(app, "touchend", 101, 102);
  app.document.getElementById("flashcard").click();
  assert.equal(app.state.flipped, true);
  for (const id of ["listenCardButton", "cardTranslation"]) {
    touch(app, "touchstart", 100, 100, { target: app.document.getElementById(id) });
    assert.equal(app.swipe.gesture, null);
  }
});

test("touch thresholds stay stable across layout changes and unrelated touchend is ignored", async () => {
  const app = await launch();
  const element = app.document.getElementById("flashcard");
  Object.defineProperty(element, "clientWidth", { value: 200, configurable: true });
  const card = app.api.currentCard();
  const attempts = card.attempts;
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 160, 110);
  Object.defineProperty(element, "clientWidth", { value: 600 });
  touch(app, "touchend", 160, 110, { changedTouches: [{ identifier: 8, clientX: 160, clientY: 110 }] });
  assert.equal(app.swipe.gesture.touchId, 7);
  assert.equal(card.attempts, attempts);
  touch(app, "touchend", 160, 110);
  assert.equal(card.attempts, attempts + 1);
});

test("a short horizontal touch drag does not flip or rate and a committed native scroll is not stolen", async () => {
  const app = await launch();
  const card = app.api.currentCard();
  const attempts = card.attempts;
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 120, 105);
  touch(app, "touchend", 120, 105);
  app.document.getElementById("flashcard").click();
  assert.equal(app.state.flipped, false);
  assert.equal(card.attempts, attempts);
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 230, 110, { cancelable: false });
  assert.equal(app.swipe.gesture.axis, "y");
  assert.equal(touch(app, "touchmove", 250, 110).defaultPrevented, false);
  touch(app, "touchend", 250, 110);
  assert.equal(card.attempts, attempts);
});

test("short drags and cancelled gestures reset cleanly without accidental answers", async () => {
  const app = await launch();
  const element = app.document.getElementById("flashcard");
  const card = app.api.currentCard();
  const attempts = card.attempts;
  pointer(app, "pointerdown", 100, 100);
  pointer(app, "pointermove", 120, 100, {}, app.window);
  pointer(app, "pointerup", 120, 100);
  element.click();
  assert.equal(app.state.flipped, false);
  assert.equal(card.attempts, attempts);
  for (const type of ["pointercancel", "lostpointercapture", "blur"]) {
    pointer(app, "pointerdown", 100, 100);
    pointer(app, "pointermove", 200, 100, {}, app.window);
    if (type === "blur") app.window.dispatchEvent(new app.window.Event("blur"));
    else pointer(app, type, 200, 100);
    assert.equal(app.swipe.gesture, null);
    assert.equal(element.style.transform, "");
    assert.equal(card.attempts, attempts);
  }
  const dragStart = new app.window.Event("dragstart", { bubbles: true, cancelable: true });
  element.dispatchEvent(dragStart);
  assert.equal(dragStart.defaultPrevented, true);
  pointer(app, "pointerdown", 100, 100);
  pointer(app, "pointermove", 210, 100, {}, app.window);
  pointer(app, "pointerup", 210, 100);
  assert.equal(card.attempts, attempts + 1);
});

test("a narrow card accepts a shorter swipe and ignores other fingers", async () => {
  const app = await launch();
  const element = app.document.getElementById("flashcard");
  Object.defineProperty(element, "clientWidth", { value: 200 });
  const card = app.api.currentCard();
  const attempts = card.attempts;
  pointer(app, "pointerdown", 100, 100);
  pointer(app, "pointermove", 200, 100, { pointerId: 2 }, app.window);
  pointer(app, "pointercancel", 200, 100, { pointerId: 2 });
  assert.equal(app.swipe.gesture.pointerId, 1);
  pointer(app, "pointermove", 160, 100, {}, app.window);
  pointer(app, "pointerup", 160, 100);
  assert.equal(card.attempts, attempts + 1);
});

test("sentence exercises use card vocabulary even with an empty trainer dictionary", async () => {
  const app = await launch();
  assert.equal(app.state.englishTrainer.words.length, 0);
  app.document.getElementById("englishSentencesTab").click();
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  const request = app.requests.find((item) => item.route === "/api/english/sentence-trainer/create-exercise");
  assert.ok(request);
  const keys = request.body.words.map((entry) => entry.word);
  assert.ok(keys.includes("pick up"));
  assert.ok(keys.includes("put down"));
  assert.equal(keys.length, new Set(keys).size);
  assert.equal(app.document.getElementById("englishTrainerExerciseCard").hidden, false);
  assert.equal(app.document.getElementById("englishTrainerStatus").textContent, "Задание готово.");
  assert.equal(app.document.getElementById("englishTrainerExerciseHint").classList.contains("is-hidden"), true);
  app.document.getElementById("englishTrainerAnswerInput").value = "Pick up the phone.";
  app.document.getElementById("checkEnglishTrainerAnswerButton").click();
  await app.flush();
  const check = app.requests.find((item) => item.route.includes("check-answer"));
  assert.ok(check.body.words.some((entry) => entry.word === "pick up"));
});

test("the common dictionary preserves manual translations and whole phrases without duplicates", async () => {
  const app = await launch();
  app.api.mergeEnglishTrainerWords([{ word: "PICK   UP", translation: "поднять", partOfSpeech: "phrase", boostRemaining: 6 }]);
  app.state.cards.push({ id: "duplicate", word: "Pick up", phrase: "Pick up the bag.", translation: "Подними сумку." });
  const words = app.api.englishTrainerWords();
  assert.equal(words.filter((entry) => entry.word === "pick up").length, 1);
  const phrase = words.find((entry) => entry.word === "pick up");
  assert.equal(phrase.translation, "поднять");
  assert.equal(phrase.boostRemaining, 6);
  const derived = words.find((entry) => entry.word === "put down");
  assert.equal(derived.translation, "");
  assert.ok(derived.notes.includes("Put the cup down"));
  app.document.getElementById("openEnglishTrainerDictionaryButton").click();
  assert.equal(app.document.getElementById("englishTrainerDictionarySummary").textContent, `${words.length} слов/фраз`);
  app.document.getElementById("englishTrainerDictionarySearch").value = "pick up";
  app.document.getElementById("englishTrainerDictionarySearch").dispatchEvent(new app.window.Event("input"));
  assert.equal(app.document.querySelectorAll("#englishTrainerDictionaryList article").length, 1);
});

test("new and edited card keywords appear automatically and all folders contribute", async () => {
  const app = await launch();
  app.state.activeFolder = "Стартовые / Действия с предметами";
  assert.ok(app.api.englishTrainerWords().some((entry) => entry.word === app.state.cards[0].word));
  app.state.cards.push({ id: "new", word: "come back", phrase: "Come back soon.", folderPath: "Other" });
  assert.ok(app.api.englishTrainerWords().some((entry) => entry.word === "come back"));
  app.state.cards.at(-1).word = "wander off";
  assert.equal(app.api.englishTrainerWords().some((entry) => entry.word === "come back"), false);
  assert.ok(app.api.englishTrainerWords().some((entry) => entry.word === "wander off"));
  app.state.cards.pop();
  assert.equal(app.api.englishTrainerWords().some((entry) => entry.word === "wander off"), false);
});

test("priorities and exclusions for card words persist without deleting flashcards", async () => {
  const app = await launch();
  const phrase = app.api.englishTrainerWords().find((entry) => entry.word === "pick up");
  app.api.boostEnglishTrainerWord(phrase.id);
  assert.equal(app.api.englishTrainerWords().find((entry) => entry.word === "pick up").boostRemaining, 8);
  await app.flush();
  await app.api.loadServerCards();
  assert.equal(app.api.englishTrainerWords().find((entry) => entry.word === "pick up").boostRemaining, 8);
  app.api.removeEnglishTrainerWord(phrase.id);
  await app.flush();
  await app.api.loadServerCards();
  assert.equal(app.api.englishTrainerWords().some((entry) => entry.word === "pick up"), false);
  assert.ok(app.state.cards.some((card) => card.word === "pick up"));
  const reloaded = await launch({ saved: app.getSaved() });
  assert.equal(reloaded.api.englishTrainerWords().some((entry) => entry.word === "pick up"), false);
  reloaded.api.mergeEnglishTrainerWords([{ word: "pick up", translation: "поднять" }]);
  assert.ok(reloaded.api.englishTrainerWords().some((entry) => entry.word === "pick up"));
});

test("offline profiles share card vocabulary with manual-text hints", async () => {
  const offline = await launch({ offline: true });
  assert.ok(offline.api.englishTrainerWords().length >= 3);
  const app = await launch();
  app.document.getElementById("openEnglishTrainerTextButton").click();
  app.document.getElementById("englishTrainerManualPromptInput").value = "Подними телефон.";
  app.document.getElementById("startEnglishTrainerManualPromptButton").click();
  await app.flush();
  const request = app.requests.find((item) => item.route.includes("prepare-manual"));
  assert.ok(request.body.words.some((entry) => entry.word === "pick up"));
});

test("first visit loads the remote word base before sending any profile updates", async () => {
  const app = await launch({ saved: {
    cards: defaults.cards,
    starterPacks: ["basic-actions-v1"],
    englishTrainer: { words: [{ id: "remote-word", word: "nevertheless", translation: "тем не менее", boostRemaining: 3 }] },
  } });
  assert.ok(app.api.englishTrainerWords().some((entry) => entry.word === "nevertheless" && entry.boostRemaining === 3));
  const updates = app.requests.filter((item) => item.body?.profile);
  assert.ok(updates.length > 0);
  assert.ok(updates.every((item) => item.body.cards.length >= defaults.cards.length));
  assert.ok(updates.every((item) => item.body.englishTrainer.words.some((entry) => entry.word === "nevertheless")));
});

test("word selection prioritises less-practised card words and rotates after each exercise", async () => {
  const app = await launch();
  app.state.englishTrainer.exercises = [{ usedWords: ["pick up", "put down"] }];
  const words = app.api.englishTrainerVocabularyForExercise();
  assert.ok(words.findIndex((word) => word.word === "pick up") > 10);
  assert.ok(words.findIndex((word) => word.word === "put down") > 10);
  assert.ok(words.some((word) => word.word === "turn upside down"));
  const selected = words[0].word;
  app.state.englishTrainer.exercises.unshift({ usedWords: [selected] });
  assert.notEqual(app.api.englishTrainerVocabularyForExercise()[0].word, selected);
});

test("a repeated AI answer is rejected and a fresh exercise is requested automatically", async () => {
  const old = { id: "old", promptRu: "Я ставлю чайник.", expectedEn: "I start the kettle.", usedWords: ["start"] };
  const app = await launch({ exerciseResponse: (body, call) => call === 1
    ? { ...old, promptRu: "Я ставлю чайник!" }
    : { promptRu: "Сегодня мы аккуратно переносим коробку.", expectedEn: "Today we carry the box carefully.", usedWords: body.focusWords } });
  app.state.englishTrainer.exercises = [old];
  app.state.englishTrainer.currentExercise = old;
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  const requests = app.requests.filter((item) => item.route.includes("create-exercise"));
  assert.equal(requests.length, 2);
  assert.ok(requests[1].body.recentExercises.some((item) => item.promptRu === "Я ставлю чайник!"));
  assert.equal(app.state.englishTrainer.currentExercise.expectedEn, "Today we carry the box carefully.");
  assert.equal(app.state.englishTrainer.exercises.length, 2);
});

test("duplicate English answers and minor reordering are recognised independently of Russian prompts", async () => {
  const app = await launch();
  assert.equal(app.api.englishExerciseTextsMatch("Pick up the phone.", "PICK UP THE PHONE!"), true);
  assert.equal(app.api.englishExerciseTextsMatch("I carefully carry the laptop home today.", "Today I carry the laptop home carefully."), true);
  assert.equal(app.api.englishExerciseTextsMatch("I lift the box.", "I lower the box."), false);
  assert.equal(app.api.englishExerciseTextsMatch("", ""), false);
});

test("repeated responses have a retry limit and never replace the previous exercise", async () => {
  const old = { id: "old", promptRu: "Подними телефон.", expectedEn: "Pick up the phone.", usedWords: ["pick up"] };
  const app = await launch({ exerciseResponse: (body) => ({ ...old, promptRu: "Возьми телефон.", usedWords: body.focusWords }) });
  app.state.englishTrainer.exercises = [old];
  app.state.englishTrainer.currentExercise = old;
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  assert.equal(app.requests.filter((item) => item.route.includes("create-exercise")).length, 3);
  assert.equal(app.state.englishTrainer.currentExercise.id, "old");
  assert.equal(app.state.englishTrainer.exercises.length, 1);
  assert.ok(app.document.getElementById("englishTrainerStatus").textContent.includes("AI повторил"));
  assert.equal(app.document.getElementById("createEnglishTrainerExerciseButton").disabled, false);
});

test("an exercise must use its selected card word and sentence types keep rotating after history fills", async () => {
  const app = await launch({ exerciseResponse: (body, call) => ({
    promptRu: `Новое задание ${call}.`, expectedEn: `New exercise ${call}.`, usedWords: call === 1 ? ["not in vocabulary"] : body.focusWords,
  }) });
  app.state.englishTrainer.exercises = Array.from({ length: 30 }, (_, index) => ({ promptRu: `Ранее ${index}.`, expectedEn: `Earlier ${index}.`, usedWords: [] }));
  app.state.englishTrainer.currentExercise = { exerciseStyle: "question" };
  const exercise = await app.api.fetchEnglishTrainerExercise(10, "hard");
  const requests = app.requests.filter((item) => item.route.includes("create-exercise"));
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.exerciseStyle, "statement");
  assert.equal(requests[0].body.mode, "hard");
  assert.equal(requests[0].body.count, 10);
  assert.ok(exercise.usedWords.includes(requests[0].body.focusWords[0]));
});

test("consecutive clicks produce different focus words and persist the rotation through reload", async () => {
  const app = await launch({ exerciseResponse: (body, call) => ({
    promptRu: `Задание номер ${call}.`, expectedEn: `Exercise number ${call}.`, usedWords: body.focusWords,
  }) });
  const button = app.document.getElementById("createEnglishTrainerExerciseButton");
  button.click();
  await app.flush();
  button.click();
  await app.flush();
  const requests = app.requests.filter((item) => item.route.includes("create-exercise"));
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0].body.focusWords[0], requests[1].body.focusWords[0]);
  assert.notEqual(requests[0].body.exerciseStyle, requests[1].body.exerciseStyle);
  assert.equal(requests[1].body.recentExercises[0].expectedEn, "Exercise number 1.");
  const reloaded = await launch({ saved: app.getSaved() });
  assert.equal(reloaded.state.englishTrainer.exercises.length, 2);
  assert.equal(reloaded.state.englishTrainer.currentExercise.exerciseStyle, requests[1].body.exerciseStyle);
});

function chooseTrainerFolder(app, folder) {
  toggleTrainerFolder(app, "all", true);
  if (folder !== "all") toggleTrainerFolder(app, folder, true);
}

function toggleTrainerFolder(app, folder, checked) {
  const checkbox = [...app.document.querySelectorAll("#englishTrainerFolderChoices input")].find((input) => input.value === folder);
  assert.ok(checkbox, `Folder checkbox exists: ${folder}`);
  checkbox.checked = checked;
  checkbox.dispatchEvent(new app.window.Event("change", { bubbles: true }));
}

test("folder-based tasks use only selected cards, combine expressions and persist the chosen folder", async () => {
  const app = await launch();
  app.api.mergeEnglishTrainerWords([{ word: "nevertheless", translation: "тем не менее" }]);
  const folder = "Стартовые / Действия с предметами";
  chooseTrainerFolder(app, folder);
  assert.equal(app.state.englishTrainer.folderPath, folder);
  const words = app.api.englishTrainerVocabularyForExercise();
  assert.equal(words.length, 20);
  assert.equal(words.some((entry) => entry.word === "nevertheless"), false);
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  const request = app.requests.find((item) => item.route.includes("create-exercise"));
  assert.equal(request.body.folderPath, folder);
  assert.equal(request.body.sourceCards.length, 20);
  assert.equal(request.body.words.length, 20);
  assert.ok(request.body.focusWords.length >= 2);
  assert.ok(request.body.sourceCards.every((card) => words.some((entry) => entry.word === card.word)));
  assert.equal(app.state.englishTrainer.currentExercise.folderPath, folder);
  const reloaded = await launch({ saved: app.getSaved() });
  assert.equal(reloaded.state.englishTrainer.folderPath, folder);
  assert.equal([...reloaded.document.querySelectorAll("#englishTrainerFolderChoices input")]
    .find((input) => input.value === folder).checked, true);
});

test("folder scope includes descendants but excludes siblings, and empty folders do not call AI", async () => {
  const app = await launch();
  app.state.cards.push({ id: "child", word: "wave", phrase: "Wave hello.", folderPath: "Custom / Child" });
  app.state.cards.push({ id: "sibling", word: "nod", phrase: "Nod hello.", folderPath: "Different" });
  app.state.folders.push("Empty");
  app.api.renderEnglishTrainer();
  chooseTrainerFolder(app, "Custom");
  assert.equal(app.api.englishTrainerVocabularyForExercise().length, 1);
  assert.equal(app.api.englishTrainerVocabularyForExercise()[0].word, "wave");
  chooseTrainerFolder(app, "Empty");
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  assert.equal(app.requests.some((item) => item.route.includes("create-exercise")), false);
  assert.ok(app.document.getElementById("englishTrainerStatus").textContent.includes("В выбранных папках нет слов"));
  chooseTrainerFolder(app, "all");
  assert.ok(app.api.englishTrainerVocabularyForExercise().length >= 50);
});

test("folder exercises reject answers that use just one of the selected expressions", async () => {
  const app = await launch({ exerciseResponse: (body, call) => ({
    promptRu: `Задание ${call}.`, expectedEn: `Exercise ${call}.`, usedWords: call === 1 ? body.focusWords.slice(0, 1) : body.focusWords,
  }) });
  chooseTrainerFolder(app, "Стартовые / Действия с предметами");
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  assert.equal(app.requests.filter((item) => item.route.includes("create-exercise")).length, 2);
  assert.ok(app.state.englishTrainer.currentExercise.usedWords.length >= 2);
  chooseTrainerFolder(app, "all");
  assert.equal(app.state.englishTrainer.currentExercise, null);
  assert.equal(app.document.getElementById("englishTrainerExerciseCard").hidden, true);
});

test("multiple folder checkboxes combine vocabulary and source cards without duplicates and persist", async () => {
  const app = await launch();
  app.state.cards = [
    { id: "a", word: "wave", phrase: "Wave hello.", folderPath: "Actions / Hands" },
    { id: "b", word: "nod", phrase: "Nod hello.", folderPath: "Actions / Head" },
    { id: "c", word: "cook", phrase: "Cook dinner.", folderPath: "Home" },
    { id: "d", word: "travel", phrase: "Travel far.", folderPath: "Other" },
  ];
  app.state.folders = [];
  app.api.mergeEnglishTrainerWords([{ word: "nevertheless", translation: "тем не менее" }]);
  app.api.renderEnglishTrainer();
  chooseTrainerFolder(app, "Actions");
  toggleTrainerFolder(app, "Actions / Hands", true);
  toggleTrainerFolder(app, "Home", true);
  assert.deepEqual(Array.from(app.state.englishTrainer.folderPaths), ["Actions", "Actions / Hands", "Home"]);
  assert.deepEqual(Array.from(app.api.englishTrainerVocabularyForExercise(), (word) => word.word).sort(), ["cook", "nod", "wave"]);
  assert.ok(app.document.getElementById("englishTrainerFolderSummary").textContent.includes("(3)"));
  assert.equal(app.document.querySelector(".trainer-folder-control").hasAttribute("open"), false);
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  assert.equal(app.document.getElementById("englishTrainerFolderChoices").disabled, true);
  toggleTrainerFolder(app, "Other", true);
  assert.equal(app.state.englishTrainer.folderPaths.includes("Other"), false);
  await app.flush();
  assert.equal(app.document.getElementById("englishTrainerFolderChoices").disabled, false);
  const request = app.requests.find((item) => item.route.includes("create-exercise"));
  assert.deepEqual(request.body.folderPaths, ["Actions", "Actions / Hands", "Home"]);
  assert.equal(request.body.sourceCards.length, 3);
  assert.equal(new Set(request.body.sourceCards.map((card) => card.word)).size, 3);
  assert.deepEqual(Array.from(app.state.englishTrainer.currentExercise.folderPaths), request.body.folderPaths);
  const saved = structuredClone(app.getSaved());
  assert.deepEqual(saved.englishTrainer.folderPaths, request.body.folderPaths);
  const reloaded = await launch({ saved });
  assert.deepEqual(Array.from(reloaded.state.englishTrainer.folderPaths), request.body.folderPaths);
  for (const input of reloaded.document.querySelectorAll("#englishTrainerFolderChoices input")) {
    assert.equal(input.checked, request.body.folderPaths.includes(input.value));
  }
  toggleTrainerFolder(app, "Actions / Hands", false);
  toggleTrainerFolder(app, "Actions", false);
  assert.deepEqual(Array.from(app.api.englishTrainerVocabularyForExercise(), (word) => word.word), ["cook"]);
  assert.equal(app.state.englishTrainer.currentExercise, null);
  toggleTrainerFolder(app, "Home", false);
  assert.deepEqual(Array.from(app.state.englishTrainer.folderPaths), ["all"]);
  assert.ok(app.api.englishTrainerVocabularyForExercise().some((word) => word.word === "nevertheless"));
});

test("folder selection migrates legacy profiles and follows the newest synced selection", async () => {
  const app = await launch();
  const normalize = app.api.normalizeEnglishTrainerState;
  assert.deepEqual(Array.from(normalize({ folderPath: "Actions" }).folderPaths), ["Actions"]);
  assert.deepEqual(Array.from(normalize({ folderPaths: [" Home ", "Actions", "Home", null] }).folderPaths), ["Actions", "Home"]);
  assert.deepEqual(Array.from(normalize({ folderPaths: [] }).folderPaths), ["all"]);
  assert.deepEqual(Array.from(normalize({ folderPaths: ["all", "Actions"] }).folderPaths), ["all"]);
  const merge = app.api.mergeEnglishTrainerState;
  const remote = { folderPaths: ["Actions", "Home"], folderUpdatedAt: 20 };
  const local = { folderPath: "Other", folderUpdatedAt: 10 };
  assert.deepEqual(Array.from(merge(remote, local).folderPaths), ["Actions", "Home"]);
  assert.deepEqual(Array.from(merge(local, remote).folderPaths), ["Actions", "Home"]);
  const legacy = await launch({ saved: { cards: [], starterPacks: [], folders: ["Actions"], englishTrainer: { folderPath: "Actions", folderUpdatedAt: 20 } } });
  assert.deepEqual(Array.from(legacy.state.englishTrainer.folderPaths), ["Actions"]);
});

test("selected folders stay together in the hierarchy and follow rename and deletion", async () => {
  const app = await launch();
  app.state.cards = [];
  app.state.folders = ["A / Child", "A!", "Other"];
  app.api.renderEnglishTrainer();
  const paths = () => [...app.document.querySelectorAll("#englishTrainerFolderChoices input")].map((input) => input.value);
  assert.equal(paths().indexOf("A / Child"), paths().indexOf("A") + 1);
  chooseTrainerFolder(app, "A / Child");
  toggleTrainerFolder(app, "Other", true);
  app.api.renameFolder("A", "Renamed");
  app.api.renderEnglishTrainer();
  assert.deepEqual(Array.from(app.state.englishTrainer.folderPaths), ["Other", "Renamed / Child"]);
  app.api.deleteFolder("Renamed");
  app.api.renderEnglishTrainer();
  assert.deepEqual(Array.from(app.state.englishTrainer.folderPaths), ["Other"]);
  app.api.deleteFolder("Other");
  app.api.renderEnglishTrainer();
  assert.deepEqual(Array.from(app.state.englishTrainer.folderPaths), ["all"]);
});

test("a large folder does not crowd out examples and focus words from another selected folder", async () => {
  const app = await launch();
  app.state.cards = Array.from({ length: 45 }, (_, index) => ({
    id: `large-${index}`, word: `action ${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`,
    phrase: `Action ${index}.`, folderPath: "Large",
  }));
  app.state.cards.push({ id: "small", word: "cook", phrase: "Cook dinner.", folderPath: "Small" });
  app.state.folders = [];
  app.api.renderEnglishTrainer();
  chooseTrainerFolder(app, "Large");
  toggleTrainerFolder(app, "Small", true);
  app.document.getElementById("createEnglishTrainerExerciseButton").click();
  await app.flush();
  const request = app.requests.find((item) => item.route.includes("create-exercise"));
  assert.equal(request.body.sourceCards.length, 40);
  assert.ok(request.body.sourceCards.some((card) => card.word === "cook"));
  assert.ok(request.body.focusWords.includes("cook"));
  toggleTrainerFolder(app, "all", true);
  assert.deepEqual(Array.from(app.state.englishTrainer.folderPaths), ["all"]);
  assert.ok([...app.document.querySelectorAll("#englishTrainerFolderChoices input")]
    .every((input) => input.checked === (input.value === "all")));
});

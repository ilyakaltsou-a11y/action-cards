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
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "public/app.js"), "utf8") + "\nglobalThis.testApi = { state, renderStudy, loadServerCards, saveCards, startEditCard, currentCard, englishTrainerWords, mergeEnglishTrainerWords, renderEnglishTrainer, removeEnglishTrainerWord, boostEnglishTrainerWord, englishTrainerVocabularyForExercise, fetchEnglishTrainerExercise, englishExerciseTextsMatch };", sandbox);
  const flush = async () => { for (let index = 0; index < 10; index += 1) await new Promise(setImmediate); };
  await flush();
  document.querySelector('[data-goal-mode="medium"]').click();
  return { document, window, state: sandbox.testApi.state, api: sandbox.testApi, requests, listeners, flush, getSaved: () => remote };
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

test("complete app startup adds all 20 basic cards to an existing profile once", async () => {
  const app = await launch();
  assert.equal(app.state.cards.length, 50);
  assert.equal(app.state.cards.filter((card) => card.id.startsWith("basic-action-")).length, 20);
  await app.api.loadServerCards();
  assert.equal(app.state.cards.length, 50);
  const ids = [...app.document.querySelectorAll("[id]")].map((element) => element.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("starter pack loads with the sync server unavailable and a stale folder selection", async () => {
  const app = await launch({ offline: true, storedFolder: "Deleted folder" });
  assert.equal(app.state.cards.length, 50);
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
  assert.equal(app.state.cards.length, 50);
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
  assert.equal(app.state.cards.length, 51);
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
  assert.equal(app.state.cards.length, 49);
  assert.equal(app.state.cards.some((card) => card.id === removed.id), false);
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
  assert.equal(app.state.drag.active, true);
  assert.equal(Number(element.style.getPropertyValue("--swipe-right-opacity")), 1);
  pointer(app, "pointerup", 220, 105);
  assert.equal(app.state.drag, null);
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
  assert.equal(app.state.drag.axis, "y");
  assert.equal(touch(app, "touchmove", 230, 210).defaultPrevented, false);
  assert.equal(app.state.drag.active, false);
  assert.equal(app.document.getElementById("flashcard").style.transform || "", "");
  touch(app, "touchend", 230, 210);
  assert.equal(card.attempts, attempts);
  app.document.getElementById("flashcard").click();
  assert.equal(app.state.flipped, false);
  app.state.ignoreFlipUntil = 0;
  pointer(app, "pointerdown", 100, 100);
  pointer(app, "pointerup", 100, 100);
  app.document.getElementById("flashcard").click();
  assert.equal(app.state.flipped, true);
  for (const id of ["listenCardButton", "cardTranslation"]) {
    pointer(app, "pointerdown", 100, 100, {}, app.document.getElementById(id));
    assert.equal(app.state.drag, null);
  }
  pointer(app, "pointerdown", 100, 100, { button: 2 });
  assert.equal(app.state.drag, null);
  pointer(app, "pointerdown", 100, 100, { isPrimary: false });
  assert.equal(app.state.drag, null);
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
    assert.equal(app.state.drag.active, false);
    assert.equal(element.hasPointerCapture(1), false);
    assert.equal(touch(app, "touchmove", 200 + direction * 20, 210).defaultPrevented, true);
    assert.equal(app.state.drag.axis, "x");
    assert.equal(touch(app, "touchmove", 200 + direction * 120, 500).defaultPrevented, true);
    assert.equal(app.state.drag.active, true);
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
  assert.equal(app.state.drag, null);
  touch(app, "touchstart", 100, 100);
  touch(app, "touchmove", 125, 104);
  for (const type of ["pointercancel", "lostpointercapture", "pointerup"]) {
    pointer(app, type, 230, 200, { pointerType: "touch" });
    assert.equal(app.state.drag.axis, "x");
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
    assert.equal(app.state.drag, null);
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
    assert.equal(app.state.drag, null);
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
  assert.equal(app.state.drag.touchId, 7);
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
  assert.equal(app.state.drag.axis, "y");
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
    assert.equal(app.state.drag, null);
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
  assert.equal(app.state.drag.pointerId, 1);
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
  const select = app.document.getElementById("englishTrainerFolderSelect");
  const options = [...select.querySelectorAll("option")];
  options.forEach((option) => option.removeAttribute("selected"));
  options.find((option) => option.value === folder).selected = true;
  select.dispatchEvent(new app.window.Event("change"));
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
  assert.equal(reloaded.document.getElementById("englishTrainerFolderSelect").value, folder);
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
  assert.ok(app.document.getElementById("englishTrainerStatus").textContent.includes("В выбранной папке нет слов"));
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

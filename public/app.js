const STORAGE_KEY = "action-cards:v2";
const PROFILE_KEY = "action-cards:profile:v1";
const PROFILE_COOKIE = "action_cards_profile";
const FOLDER_KEY = "action-cards:folder:v1";
const ACTIVITY_KEY = "action-cards:activity:v1";
const LANGUAGE_KEY = "action-cards:language:v1";
const POLISH_KEY = "action-cards:polish:v1";
const DEFAULT_CARDS_URL = "default-cards.json?v=52";
const SONG_ROOT_FOLDER = "Только песни";
const AGAIN_REVIEW_DELAY = 45 * 1000;
const CREATE_CARD_TIMEOUT = 140 * 1000;
const SONG_CARD_TIMEOUT = 480 * 1000;
const POLISH_AI_TIMEOUT = 120 * 1000;
const POLISH_PREFETCH_TARGET = 3;
const MAX_SONG_LINES = 24;
const SWIPE_THRESHOLD = 86;
const DAILY_GOAL_OPTIONS = {
  easy: { label: "Легкий", cards: 1 },
  medium: { label: "Средний", cards: 7 },
  hard: { label: "Сложный", cards: 15 },
};
const DEFAULT_DAILY_GOAL_MODE = "medium";
const ACTIVITY_MILESTONES = [14, 30, 180, 365];
const FREEZE_REVIEW_STEP = 30;
const TOPICS = [
  { id: "daily", label: "Быт" },
  { id: "work", label: "Работа и учеба" },
  { id: "travel", label: "Дорога" },
  { id: "general", label: "Общее" },
];
const REVIEW_INTERVALS = [
  30 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
  12 * 60 * 60 * 1000,
  2 * 24 * 60 * 60 * 1000,
  5 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
];

const state = {
  cards: [],
  folders: [],
  currentIndex: 0,
  flipped: false,
  draft: null,
  aiOnline: false,
  deepSeekOnline: false,
  aiStatusMessage: "Проверяю AI...",
  language: "english",
  installPrompt: null,
  profileId: "",
  activeFolder: "all",
  activity: { days: {}, updatedAt: 0 },
  songParentFolder: SONG_ROOT_FOLDER,
  expandedFolders: new Set(),
  songExpandedFolders: new Set([SONG_ROOT_FOLDER]),
  selectionMode: false,
  selectedCardIds: new Set(),
  editingCardId: "",
  polish: { words: [], exercises: [], currentExercise: null, feedback: null },
  polishHintVisible: false,
  polishPrefetching: false,
  drag: null,
  dragResetTimer: 0,
  ignoreFlipUntil: 0,
};

const els = {
  studyTitle: document.querySelector("#studyTitle"),
  creatorTitle: document.querySelector("#creatorTitle"),
  reviewStatus: document.querySelector("#reviewStatus"),
  flashcard: document.querySelector("#flashcard"),
  cardImage: document.querySelector("#cardImage"),
  cardPhrase: document.querySelector("#cardPhrase"),
  cardTranslation: document.querySelector("#cardTranslation"),
  speechStatus: document.querySelector("#speechStatus"),
  listenCardButton: document.querySelector("#listenCardButton"),
  againButton: document.querySelector("#againButton"),
  gotItButton: document.querySelector("#gotItButton"),
  activityButton: document.querySelector("#activityButton"),
  activityFlame: document.querySelector("#activityFlame"),
  activityDialogFlame: document.querySelector("#activityDialogFlame"),
  activityCount: document.querySelector("#activityCount"),
  activitySummary: document.querySelector("#activitySummary"),
  activityProgressFill: document.querySelector("#activityProgressFill"),
  activityProgressText: document.querySelector("#activityProgressText"),
  activityStreakText: document.querySelector("#activityStreakText"),
  activityGoalText: document.querySelector("#activityGoalText"),
  activityFreezeText: document.querySelector("#activityFreezeText"),
  changeGoalButton: document.querySelector("#changeGoalButton"),
  creatorForm: document.querySelector("#creatorForm"),
  phraseModeInputs: document.querySelectorAll('input[name="phraseMode"]'),
  wordInput: document.querySelector("#wordInput"),
  manualPhraseField: document.querySelector("#manualPhraseField"),
  manualPhraseInput: document.querySelector("#manualPhraseInput"),
  imagePreferenceInput: document.querySelector("#imagePreferenceInput"),
  generateButton: document.querySelector("#generateButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  generationStatus: document.querySelector("#generationStatus"),
  aiStatusDot: document.querySelector("#aiStatusDot"),
  draftCard: document.querySelector("#draftCard"),
  draftImage: document.querySelector("#draftImage"),
  draftPhrase: document.querySelector("#draftPhrase"),
  draftTranslation: document.querySelector("#draftTranslation"),
  draftScene: document.querySelector("#draftScene"),
  listenDraftButton: document.querySelector("#listenDraftButton"),
  regenerateButton: document.querySelector("#regenerateButton"),
  saveDraftButton: document.querySelector("#saveDraftButton"),
  clearButton: document.querySelector("#clearButton"),
  selectCardsButton: document.querySelector("#selectCardsButton"),
  bulkToolbar: document.querySelector("#bulkToolbar"),
  selectedCardsCount: document.querySelector("#selectedCardsCount"),
  cancelSelectionButton: document.querySelector("#cancelSelectionButton"),
  selectVisibleCardsButton: document.querySelector("#selectVisibleCardsButton"),
  bulkFolderSelect: document.querySelector("#bulkFolderSelect"),
  moveSelectedCardsButton: document.querySelector("#moveSelectedCardsButton"),
  deleteSelectedCardsButton: document.querySelector("#deleteSelectedCardsButton"),
  openDeckButton: document.querySelector("#openDeckButton"),
  openDeckSummaryButton: document.querySelector("#openDeckSummaryButton"),
  closeDeckButton: document.querySelector("#closeDeckButton"),
  deckDialog: document.querySelector("#deckDialog"),
  deckSummary: document.querySelector("#deckSummary"),
  folderTree: document.querySelector("#folderTree"),
  folderSummary: document.querySelector("#folderSummary"),
  folderNameInput: document.querySelector("#folderNameInput"),
  createFolderButton: document.querySelector("#createFolderButton"),
  openSongButton: document.querySelector("#openSongButton"),
  songSearchButton: document.querySelector("#songSearchButton"),
  closeSongButton: document.querySelector("#closeSongButton"),
  songDialog: document.querySelector("#songDialog"),
  songForm: document.querySelector("#songForm"),
  songTitleInput: document.querySelector("#songTitleInput"),
  songLyricsLink: document.querySelector("#songLyricsLink"),
  songCandidates: document.querySelector("#songCandidates"),
  songFolderTree: document.querySelector("#songFolderTree"),
  songFolderPreview: document.querySelector("#songFolderPreview"),
  addSongFolderButton: document.querySelector("#addSongFolderButton"),
  songFolderInput: document.querySelector("#songFolderInput"),
  songTextInput: document.querySelector("#songTextInput"),
  songStatus: document.querySelector("#songStatus"),
  createSongButton: document.querySelector("#createSongButton"),
  profileInput: document.querySelector("#profileInput"),
  loadProfileButton: document.querySelector("#loadProfileButton"),
  newProfileButton: document.querySelector("#newProfileButton"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  closeActivityButton: document.querySelector("#closeActivityButton"),
  activityDialog: document.querySelector("#activityDialog"),
  goalDialog: document.querySelector("#goalDialog"),
  goalOptionButtons: document.querySelectorAll("[data-goal-mode]"),
  deckList: document.querySelector("#deckList"),
  deckItemTemplate: document.querySelector("#deckItemTemplate"),
  installButton: document.querySelector("#installButton"),
  englishModeButton: document.querySelector("#englishModeButton"),
  polishModeButton: document.querySelector("#polishModeButton"),
  englishView: document.querySelector("#englishView"),
  polishView: document.querySelector("#polishView"),
  polishAiStatus: document.querySelector("#polishAiStatus"),
  polishWordCount: document.querySelector("#polishWordCount"),
  polishWordsInput: document.querySelector("#polishWordsInput"),
  addPolishWordsButton: document.querySelector("#addPolishWordsButton"),
  suggestPolishWordsButton: document.querySelector("#suggestPolishWordsButton"),
  openPolishDictionaryButton: document.querySelector("#openPolishDictionaryButton"),
  polishDictionarySummary: document.querySelector("#polishDictionarySummary"),
  polishDictionaryPreview: document.querySelector("#polishDictionaryPreview"),
  polishDictionaryDialog: document.querySelector("#polishDictionaryDialog"),
  closePolishDictionaryButton: document.querySelector("#closePolishDictionaryButton"),
  polishDictionarySearch: document.querySelector("#polishDictionarySearch"),
  polishDictionaryFilter: document.querySelector("#polishDictionaryFilter"),
  polishDictionaryCount: document.querySelector("#polishDictionaryCount"),
  polishDictionaryList: document.querySelector("#polishDictionaryList"),
  polishExerciseCount: document.querySelector("#polishExerciseCount"),
  polishExerciseMode: document.querySelector("#polishExerciseMode"),
  createPolishExerciseButton: document.querySelector("#createPolishExerciseButton"),
  polishExerciseCard: document.querySelector("#polishExerciseCard"),
  polishPromptRu: document.querySelector("#polishPromptRu"),
  polishExerciseHint: document.querySelector("#polishExerciseHint"),
  polishUsedWords: document.querySelector("#polishUsedWords"),
  polishAnswerInput: document.querySelector("#polishAnswerInput"),
  checkPolishAnswerButton: document.querySelector("#checkPolishAnswerButton"),
  polishFeedback: document.querySelector("#polishFeedback"),
  polishStatus: document.querySelector("#polishStatus"),
};

function normalizeWord(value) {
  return value.trim().toLowerCase().replace(/[^a-z -]/g, "").replace(/\s+/g, " ");
}

function normalizeProfileId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
}

function normalizeFreeText(value, maxLength = 260) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizePolishWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźż -]/gi, "")
    .replace(/\s+/g, " ")
    .slice(0, 90);
}

function polishWordKey(word) {
  return normalizePolishWord(word)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeFolderPath(value) {
  return String(value || "")
    .split("/")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

function cleanSongPart(value) {
  return String(value || "")
    .replace(/\b(lyrics?|official|audio|video|music video|song)\b/gi, "")
    .replace(/[()[\]{}"]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseSongTitle(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  const normalized = raw
    .replace(/\s+lyrics?\b/gi, "")
    .replace(/\s*[-–—|:]\s*/g, " — ");
  const parts = normalized.split(" — ").map(cleanSongPart).filter(Boolean);
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(" — ") };
  }
  return { artist: "", title: cleanSongPart(normalized) };
}

function generateProfileId() {
  return `deck-${crypto.randomUUID().slice(0, 8)}`;
}

function topicLabel(topicId) {
  return TOPICS.find((topic) => topic.id === topicId)?.label || "Общее";
}

function defaultFolderForCard(card) {
  const topic = card.topic || inferTopic(card);
  if (topic === "daily") return "Стартовые / Быт";
  if (topic === "work") return "Стартовые / Работа и учеба";
  if (topic === "travel") return "Стартовые / Дорога";
  if (topic === "freight") return "Архив / Грузоперевозки";
  return "Стартовые / Общее";
}

function inferTopic(card) {
  const text = `${card.word || ""} ${card.phrase || ""} ${card.scene || ""}`.toLowerCase();
  const freightWords = [
    "shipment",
    "delivery",
    "warehouse",
    "pallet",
    "invoice",
    "route",
    "customs",
    "container",
    "forklift",
    "unload",
    "truck",
    "cargo",
    "depot",
    "loading",
    "driver",
  ];
  const dailyWords = [
    "borrow",
    "prepare",
    "remind",
    "return",
    "search",
    "waste",
    "collect",
    "afford",
    "umbrella",
    "milk",
    "kitchen",
    "home",
    "library",
    "apartment",
    "furniture",
  ];
  const workWords = [
    "arrange",
    "complain",
    "decide",
    "explain",
    "improve",
    "manage",
    "notice",
    "promise",
    "suggest",
    "support",
    "meeting",
    "office",
    "report",
    "exam",
    "pronunciation",
    "rule",
  ];
  const travelWords = ["avoid", "train", "bus", "traffic", "road", "hotel", "restaurant", "cinema", "trip"];

  if (freightWords.some((word) => text.includes(word))) return "freight";
  if (dailyWords.some((word) => text.includes(word))) return "daily";
  if (workWords.some((word) => text.includes(word))) return "work";
  if (travelWords.some((word) => text.includes(word))) return "travel";
  return "general";
}

function cardTopic(card) {
  return card.topic || inferTopic(card);
}

function cardFolder(card) {
  return normalizeFolderPath(card.folderPath) || defaultFolderForCard(card);
}

function folderLabel(folderPath) {
  if (folderPath === "all") return "Все папки";
  return folderPath || "Без папки";
}

function folderDepth(folderPath) {
  if (folderPath === "all") return 0;
  return normalizeFolderPath(folderPath).split(" / ").filter(Boolean).length;
}

function parentFolder(folderPath) {
  const parts = normalizeFolderPath(folderPath).split(" / ").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "";
}

function folderMatches(card) {
  return folderDescendantMatches(card, state.activeFolder);
}

function folderDescendantMatches(card, folderPath) {
  const cardPath = cardFolder(card);
  return folderPath === "all" || cardPath === folderPath || cardPath.startsWith(`${folderPath} / `);
}

function getLocalCardsKey() {
  return `${STORAGE_KEY}:${state.profileId}`;
}

function getLocalFoldersKey() {
  return `${STORAGE_KEY}:folders:${state.profileId}`;
}

function getLocalActivityKey() {
  return `${ACTIVITY_KEY}:${state.profileId}`;
}

function getLocalPolishKey() {
  return `${POLISH_KEY}:${state.profileId}`;
}

function readCookie(name) {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

function rememberProfileId(profileId) {
  state.profileId = normalizeProfileId(profileId);
  localStorage.setItem(PROFILE_KEY, state.profileId);
  document.cookie = `${PROFILE_COOKIE}=${encodeURIComponent(state.profileId)}; max-age=31536000; path=/; SameSite=Lax`;
  els.profileInput.value = state.profileId;

  const url = new URL(window.location.href);
  url.searchParams.set("profile", state.profileId);
  window.history.replaceState({}, "", url);
}

function findExistingLocalProfileId() {
  let bestProfile = "";
  let bestFreshness = -1;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index) || "";
    if (!key.startsWith(`${STORAGE_KEY}:`)) continue;

    const profileId = normalizeProfileId(key.slice(`${STORAGE_KEY}:`.length));
    if (!profileId) continue;

    try {
      const cards = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(cards) || !cards.length) continue;

      const freshness = Math.max(...cards.map(cardFreshness));
      if (freshness > bestFreshness) {
        bestProfile = profileId;
        bestFreshness = freshness;
      }
    } catch {
      // Ignore broken local entries and keep looking for a usable profile.
    }
  }

  return bestProfile;
}

function initProfile() {
  const urlProfile = normalizeProfileId(new URL(window.location.href).searchParams.get("profile") || "");
  const savedProfile = normalizeProfileId(localStorage.getItem(PROFILE_KEY) || "");
  const cookieProfile = normalizeProfileId(decodeURIComponent(readCookie(PROFILE_COOKIE)));
  const existingProfile = findExistingLocalProfileId();
  const savedFolder = normalizeFolderPath(localStorage.getItem(FOLDER_KEY) || "all");
  state.activeFolder = savedFolder || "all";
  rememberProfileId(urlProfile || savedProfile || cookieProfile || existingProfile || generateProfileId());
}

function loadLocalCards() {
  try {
    const savedCards = JSON.parse(localStorage.getItem(getLocalCardsKey())) || [];
    state.cards = savedCards.map(hydrateCard);
    const savedFolders = JSON.parse(localStorage.getItem(getLocalFoldersKey())) || [];
    state.folders = Array.isArray(savedFolders) ? savedFolders.map(normalizeFolderPath).filter(Boolean) : [];
    state.activity = normalizeActivity(JSON.parse(localStorage.getItem(getLocalActivityKey()) || "{}"));
    state.polish = normalizePolishState(JSON.parse(localStorage.getItem(getLocalPolishKey()) || "{}"));
  } catch {
    state.cards = [];
    state.folders = [];
    state.activity = normalizeActivity();
    state.polish = normalizePolishState();
  }
}

async function loadServerCards() {
  const response = await fetch(`/api/cards?profile=${encodeURIComponent(state.profileId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("cards sync failed");
  const data = await response.json();
  if (Array.isArray(data.cards)) {
    const localCards = [...state.cards];
    const serverCards = data.cards.map(hydrateCard);
    state.cards = mergeCards(serverCards, localCards);
    if (Array.isArray(data.folders)) {
      mergeFolders(data.folders);
    }
    const localActivity = normalizeActivity(state.activity);
    const serverActivity = normalizeActivity(data.activity);
    state.activity = mergeActivity(serverActivity, localActivity);
    const localPolish = normalizePolishState(state.polish);
    const serverPolish = normalizePolishState(data.polish);
    state.polish = mergePolishState(serverPolish, localPolish);
    if (!state.cards.length) {
      state.cards = await loadStarterCards();
    }
    localStorage.setItem(getLocalCardsKey(), JSON.stringify(state.cards));
    localStorage.setItem(getLocalFoldersKey(), JSON.stringify(getAllFolders()));
    localStorage.setItem(getLocalActivityKey(), JSON.stringify(state.activity));
    localStorage.setItem(getLocalPolishKey(), JSON.stringify(state.polish));
    renderStudy(0);
    renderPolish();
    syncGoalDialog();
    if (
      !cardsHaveSameSyncState(state.cards, serverCards) ||
      !foldersHaveSameSyncState(data.folders || [], getAllFolders()) ||
      !activitiesHaveSameSyncState(state.activity, serverActivity) ||
      polishSyncSignature(state.polish) !== polishSyncSignature(serverPolish)
    ) {
      syncCardsToServer();
    }
  }
}

async function loadStarterCards() {
  try {
    const response = await fetch(DEFAULT_CARDS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("starter cards unavailable");
    const data = await response.json();
    const cards = Array.isArray(data.cards) ? data.cards.map(hydrateCard) : [];
    return cards.map((card, index) => ({
      ...card,
      id: `starter-${state.profileId}-${index + 1}`,
      attempts: 0,
      correct: 0,
      level: 0,
      nextReviewAt: 0,
      lastReviewedAt: 0,
      createdAt: Date.now() + index,
      updatedAt: 0,
    }));
  } catch {
    return [];
  }
}

function saveCards() {
  localStorage.setItem(getLocalCardsKey(), JSON.stringify(state.cards));
  localStorage.setItem(getLocalFoldersKey(), JSON.stringify(getAllFolders()));
  localStorage.setItem(getLocalActivityKey(), JSON.stringify(state.activity));
  localStorage.setItem(getLocalPolishKey(), JSON.stringify(state.polish));
  syncCardsToServer();
}

function getAllFolders() {
  const folderSet = new Set(state.folders.map(normalizeFolderPath).filter(Boolean));
  state.cards.forEach((card) => folderSet.add(cardFolder(card)));
  return [...folderSet].sort((left, right) => left.localeCompare(right, "ru"));
}

function mergeFolders(folders = []) {
  const folderSet = new Set(getAllFolders());
  folders.map(normalizeFolderPath).filter(Boolean).forEach((folder) => folderSet.add(folder));
  state.folders = [...folderSet].sort((left, right) => left.localeCompare(right, "ru"));
}

function foldersHaveSameSyncState(leftFolders = [], rightFolders = []) {
  return JSON.stringify(leftFolders.map(normalizeFolderPath).filter(Boolean).sort()) ===
    JSON.stringify(rightFolders.map(normalizeFolderPath).filter(Boolean).sort());
}

function normalizeActivity(activity = {}) {
  const days = {};
  if (activity && typeof activity.days === "object") {
    Object.entries(activity.days).forEach(([date, count]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const cleanCount = Math.max(0, Math.min(999, Number(count) || 0));
      if (cleanCount > 0) days[date] = cleanCount;
    });
  }

  const frozenDays = {};
  if (activity && typeof activity.frozenDays === "object") {
    Object.entries(activity.frozenDays).forEach(([date, isFrozen]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && isFrozen) frozenDays[date] = true;
    });
  }

  return {
    days,
    frozenDays,
    freezes: Math.max(0, Math.min(999, Number(activity?.freezes) || 0)),
    totalReviews: Math.max(0, Number(activity?.totalReviews) || 0),
    goalMode: DAILY_GOAL_OPTIONS[activity?.goalMode] ? activity.goalMode : "",
    lastWeeklyFreeze: String(activity?.lastWeeklyFreeze || ""),
    updatedAt: Number.isFinite(activity?.updatedAt) ? activity.updatedAt : 0,
  };
}

function mergeActivity(serverActivity = {}, localActivity = {}) {
  const server = normalizeActivity(serverActivity);
  const local = normalizeActivity(localActivity);
  const days = { ...server.days };
  const frozenDays = { ...server.frozenDays, ...local.frozenDays };

  Object.entries(local.days).forEach(([date, count]) => {
    days[date] = Math.max(days[date] || 0, count);
  });

  return {
    days,
    frozenDays,
    freezes: Math.max(server.freezes || 0, local.freezes || 0),
    totalReviews: Math.max(server.totalReviews || 0, local.totalReviews || 0),
    goalMode: local.goalMode || server.goalMode || "",
    lastWeeklyFreeze: [server.lastWeeklyFreeze, local.lastWeeklyFreeze].sort().at(-1) || "",
    updatedAt: Math.max(server.updatedAt || 0, local.updatedAt || 0),
  };
}

function activitiesHaveSameSyncState(leftActivity = {}, rightActivity = {}) {
  const normalizeForCompare = (activity) => {
    const normalized = normalizeActivity(activity);
    return {
      days: Object.fromEntries(Object.entries(normalized.days).sort(([left], [right]) => left.localeCompare(right))),
      frozenDays: Object.fromEntries(Object.entries(normalized.frozenDays).sort(([left], [right]) => left.localeCompare(right))),
      freezes: normalized.freezes,
      totalReviews: normalized.totalReviews,
      goalMode: normalized.goalMode,
      lastWeeklyFreeze: normalized.lastWeeklyFreeze,
    };
  };
  return JSON.stringify(normalizeForCompare(leftActivity)) === JSON.stringify(normalizeForCompare(rightActivity));
}

function normalizePolishWordEntry(entry = {}) {
  const word = normalizePolishWord(entry.word || entry.polish || "");
  if (!word) return null;
  const partOfSpeech = normalizeFreeText(entry.partOfSpeech || entry.pos || "", 40) || (word.includes(" ") ? "phrase" : "");
  return {
    id: entry.id || crypto.randomUUID(),
    word,
    translation: normalizeFreeText(entry.translation || entry.ru || "", 80),
    partOfSpeech,
    gender: normalizeFreeText(entry.gender || "", 30),
    level: normalizeFreeText(entry.level || "A1", 20),
    notes: normalizeFreeText(entry.notes || "", 160),
    forms: entry.forms && typeof entry.forms === "object" ? entry.forms : {},
    createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
  };
}

function normalizePolishExercise(exercise = {}) {
  if (!exercise.promptRu) return null;
  return {
    id: exercise.id || crypto.randomUUID(),
    promptRu: normalizeFreeText(exercise.promptRu, 620),
    expectedPl: normalizeFreeText(exercise.expectedPl, 620),
    hint: normalizeFreeText(exercise.hint, 420),
    mode: ["easy", "medium", "hard"].includes(exercise.mode) ? exercise.mode : "medium",
    targetCount: [5, 10, 20].includes(Number(exercise.targetCount || exercise.count)) ? Number(exercise.targetCount || exercise.count) : 10,
    usedWords: Array.isArray(exercise.usedWords) ? exercise.usedWords.map(normalizePolishWord).filter(Boolean).slice(0, 16) : [],
    grammarFocus: Array.isArray(exercise.grammarFocus) ? exercise.grammarFocus.map((item) => normalizeFreeText(item, 100)).filter(Boolean).slice(0, 8) : [],
    createdAt: Number.isFinite(exercise.createdAt) ? exercise.createdAt : Date.now(),
  };
}

function normalizePolishState(polish = {}) {
  const wordsByKey = new Map();
  if (Array.isArray(polish.words)) {
    polish.words.forEach((entry) => {
      const normalized = normalizePolishWordEntry(entry);
      if (!normalized) return;
      const key = polishWordKey(normalized.word);
      wordsByKey.set(key, { ...(wordsByKey.get(key) || {}), ...normalized });
    });
  }

  const exercises = Array.isArray(polish.exercises)
    ? polish.exercises.map(normalizePolishExercise).filter(Boolean).slice(0, 30)
    : [];
  const currentExercise = normalizePolishExercise(polish.currentExercise || {}) || null;
  const preparedExercises = Array.isArray(polish.preparedExercises)
    ? polish.preparedExercises.map(normalizePolishExercise).filter(Boolean).slice(0, POLISH_PREFETCH_TARGET)
    : [];

  return {
    words: [...wordsByKey.values()].sort((left, right) => left.word.localeCompare(right.word, "pl")),
    exercises,
    currentExercise,
    preparedExercises,
    feedback: polish.feedback && typeof polish.feedback === "object" ? polish.feedback : null,
  };
}

function polishSyncSignature(polish = {}) {
  const normalized = normalizePolishState(polish);
  return JSON.stringify({
    words: normalized.words.map((word) => ({
      word: word.word,
      translation: word.translation,
      partOfSpeech: word.partOfSpeech,
      gender: word.gender,
      level: word.level,
      notes: word.notes,
      forms: word.forms,
    })),
    currentExercise: normalized.currentExercise,
    exercises: normalized.exercises,
    preparedExercises: normalized.preparedExercises,
  });
}

function mergePolishState(serverPolish = {}, localPolish = {}) {
  const mergedWords = [...normalizePolishState(serverPolish).words, ...normalizePolishState(localPolish).words];
  const exercisesById = new Map();
  [...normalizePolishState(serverPolish).exercises, ...normalizePolishState(localPolish).exercises].forEach((exercise) => {
    exercisesById.set(exercise.id, exercise);
  });
  const currentExercise = normalizePolishState(localPolish).currentExercise || normalizePolishState(serverPolish).currentExercise;
  return normalizePolishState({
    words: mergedWords,
    exercises: [...exercisesById.values()].sort((left, right) => right.createdAt - left.createdAt),
    currentExercise,
    preparedExercises: normalizePolishState(localPolish).preparedExercises.length
      ? normalizePolishState(localPolish).preparedExercises
      : normalizePolishState(serverPolish).preparedExercises,
    feedback: normalizePolishState(localPolish).feedback || normalizePolishState(serverPolish).feedback,
  });
}

async function syncCardsToServer() {
  try {
    await fetch("/api/cards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: state.profileId, cards: state.cards, folders: getAllFolders(), activity: state.activity, polish: state.polish }),
    });
  } catch {
    setStatus("Карточки сохранены на этом устройстве. Сервер синхронизации сейчас недоступен.", "warn");
  }
}

function hydrateCard(card) {
  return {
    id: card.id || crypto.randomUUID(),
    word: card.word || "",
    phrase: card.phrase || card.answer || "",
    translation: card.translation || "",
    topic: card.topic || inferTopic(card),
    folderPath: normalizeFolderPath(card.folderPath) || defaultFolderForCard(card),
    scene: card.scene || card.prompt || "",
    imagePreference: card.imagePreference || "",
    imageUrl: card.imageUrl || "",
    attempts: Number.isFinite(card.attempts) ? card.attempts : 0,
    correct: Number.isFinite(card.correct) ? card.correct : 0,
    level: Number.isFinite(card.level) ? card.level : 0,
    nextReviewAt: Number.isFinite(card.nextReviewAt) ? card.nextReviewAt : 0,
    lastReviewedAt: Number.isFinite(card.lastReviewedAt) ? card.lastReviewedAt : 0,
    createdAt: Number.isFinite(card.createdAt) ? card.createdAt : Date.now(),
    updatedAt: Number.isFinite(card.updatedAt) ? card.updatedAt : 0,
  };
}

function cardFreshness(card) {
  return Math.max(card?.updatedAt || 0, card?.lastReviewedAt || 0, card?.nextReviewAt || 0, card?.createdAt || 0);
}

function mergeCards(serverCards, localCards) {
  const cardsById = new Map();

  [...serverCards, ...localCards].map(hydrateCard).forEach((card) => {
    const savedCard = cardsById.get(card.id);
    if (!savedCard || cardFreshness(card) >= cardFreshness(savedCard)) {
      cardsById.set(card.id, card);
    }
  });

  return [...serverCards, ...localCards]
    .map(hydrateCard)
    .filter((card, index, cards) => cards.findIndex((savedCard) => savedCard.id === card.id) === index)
    .map((card) => cardsById.get(card.id));
}

function cardSyncSignature(card) {
  const savedCard = hydrateCard(card);

  return [
    savedCard.id,
    savedCard.word,
    savedCard.phrase,
    savedCard.translation,
    savedCard.topic,
    savedCard.folderPath,
    savedCard.scene,
    savedCard.imagePreference,
    savedCard.imageUrl,
    savedCard.attempts,
    savedCard.correct,
    savedCard.level,
    savedCard.nextReviewAt,
    savedCard.lastReviewedAt,
    savedCard.createdAt,
    savedCard.updatedAt,
  ].join("\u001f");
}

function cardsHaveSameSyncState(leftCards, rightCards) {
  if (leftCards.length !== rightCards.length) return false;

  const rightById = new Map(rightCards.map((card) => [card.id, cardSyncSignature(card)]));
  return leftCards.every((card) => rightById.get(card.id) === cardSyncSignature(card));
}

function createCard(draft) {
  return hydrateCard({
    id: crypto.randomUUID(),
    word: draft.word,
    phrase: draft.phrase,
    translation: draft.translation,
    topic: draft.topic || inferTopic(draft),
    folderPath: normalizeFolderPath(draft.folderPath) || (state.activeFolder !== "all" ? state.activeFolder : defaultFolderForCard(draft)),
    scene: draft.scene,
    imagePreference: draft.imagePreference || "",
    imageUrl: draft.imageUrl,
    createdAt: Date.now(),
  });
}

function getStudyDeck() {
  return state.cards.filter(folderMatches);
}

function difficultyScore(card) {
  const attempts = Math.max(0, card.attempts || 0);
  const correct = Math.max(0, card.correct || 0);
  const misses = Math.max(0, attempts - correct);
  const accuracy = attempts ? correct / attempts : 0;
  const level = Math.max(0, card.level || 0);

  return misses * 80 + (1 - accuracy) * 90 + (REVIEW_INTERVALS.length - 1 - level) * 12;
}

function currentCard() {
  return getStudyDeck()[state.currentIndex] || null;
}

function clampStudyIndex(index = state.currentIndex) {
  const deck = getStudyDeck();
  if (!deck.length) return 0;
  return (index + deck.length) % deck.length;
}

function setVisual(element, imageUrl, fallbackText = "") {
  element.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";
  element.classList.toggle("has-image", Boolean(imageUrl));
  element.textContent = imageUrl ? "" : fallbackText;
}

function setTranslation(text = "", hidden = true) {
  const translation = String(text).trim() || "Перевод появится у новых карточек.";
  const textElement = els.cardTranslation.querySelector(".translation-text");
  const labelElement = els.cardTranslation.querySelector(".translation-label");

  textElement.textContent = translation;
  els.cardTranslation.classList.toggle("is-hidden", hidden);
  labelElement.textContent = hidden ? "Перевод по нажатию" : "Перевод";
  els.cardTranslation.setAttribute("aria-label", hidden ? "Показать русский перевод" : "Русский перевод открыт");
}

function hideTranslation() {
  setTranslation(currentCard()?.translation || "", true);
}

function toggleTranslation(event) {
  event?.stopPropagation();
  if (!currentCard()) return;
  const shouldHide = !els.cardTranslation.classList.contains("is-hidden");
  setTranslation(currentCard().translation, shouldHide);
}

function reviewLabel(card) {
  if (!card) return "0 карточек";
  if (!card.attempts) return "Новая";
  if ((card.nextReviewAt || 0) <= Date.now()) return "Пора повторить";

  const minutes = Math.ceil((card.nextReviewAt - Date.now()) / 60000);
  if (minutes < 60) return `Через ${minutes} мин`;
  if (minutes < 1440) return `Через ${Math.ceil(minutes / 60)} ч`;
  return `Через ${Math.ceil(minutes / 1440)} д`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateKey(dateKey, offsetDays) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + offsetDays);
  return localDateKey(date);
}

function weekKey(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor((date - start) / 86400000);
  return `${date.getFullYear()}-w${String(Math.floor(dayOffset / 7) + 1).padStart(2, "0")}`;
}

function selectedGoalMode() {
  return DAILY_GOAL_OPTIONS[state.activity?.goalMode] ? state.activity.goalMode : DEFAULT_DAILY_GOAL_MODE;
}

function dailyActivityGoal() {
  return DAILY_GOAL_OPTIONS[selectedGoalMode()].cards;
}

function dailyActivityGoalLabel() {
  return DAILY_GOAL_OPTIONS[selectedGoalMode()].label;
}

function hasChosenActivityGoal() {
  return Boolean(DAILY_GOAL_OPTIONS[state.activity?.goalMode]);
}

function isCompletedActivityDate(dateKey) {
  return (state.activity.days?.[dateKey] || 0) >= dailyActivityGoal();
}

function isFrozenActivityDate(dateKey) {
  return Boolean(state.activity.frozenDays?.[dateKey]);
}

function completedActivityDates() {
  const dates = new Set();
  Object.entries(state.activity.days || {}).forEach(([date, count]) => {
    if (count >= dailyActivityGoal()) dates.add(date);
  });
  Object.keys(state.activity.frozenDays || {}).forEach((date) => dates.add(date));
  return dates;
}

function persistActivity() {
  localStorage.setItem(getLocalActivityKey(), JSON.stringify(state.activity));
  syncCardsToServer();
}

function grantWeeklyFreeze() {
  const currentWeek = weekKey();
  if (state.activity.lastWeeklyFreeze === currentWeek) return false;
  state.activity.lastWeeklyFreeze = currentWeek;
  state.activity.freezes += 1;
  return true;
}

function applyAutomaticFreezes() {
  const today = localDateKey();
  const yesterday = shiftDateKey(today, -1);
  const activeDates = [...completedActivityDates()].filter((date) => date < today).sort();
  if (!activeDates.length) return false;

  let changed = false;
  let cursor = shiftDateKey(activeDates.at(-1), 1);
  while (cursor <= yesterday) {
    if (!isCompletedActivityDate(cursor) && !isFrozenActivityDate(cursor)) {
      if (state.activity.freezes <= 0) break;
      state.activity.frozenDays[cursor] = true;
      state.activity.freezes -= 1;
      changed = true;
    }
    cursor = shiftDateKey(cursor, 1);
  }

  return changed;
}

function prepareActivity() {
  state.activity = normalizeActivity(state.activity);
  let changed = false;
  changed = grantWeeklyFreeze() || changed;
  changed = applyAutomaticFreezes() || changed;

  if (changed) {
    state.activity.updatedAt = Date.now();
    persistActivity();
  }
}

function calculateActivityStreak() {
  const completed = completedActivityDates();
  const today = localDateKey();
  const yesterday = shiftDateKey(today, -1);
  let cursor = completed.has(today) ? today : completed.has(yesterday) ? yesterday : "";
  let streak = 0;

  while (cursor && completed.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

function calculateBestActivityStreak() {
  const dates = [...completedActivityDates()].sort();
  let best = 0;
  let current = 0;
  let previous = "";

  dates.forEach((date) => {
    current = previous && shiftDateKey(previous, 1) === date ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  });

  return best;
}

function milestoneLabel(days) {
  if (days === 30) return "1 месяц";
  if (days === 180) return "6 месяцев";
  if (days === 365) return "1 год";
  return `${days} дней`;
}

function flameLevel(todayCount, todayDone, streak) {
  if (!todayCount && !todayDone) return 0;
  if (todayCount < 3) return 1;
  if (!todayDone) return 2;
  if (streak >= 14) return 5;
  if (streak >= 7) return 4;
  return 3;
}

function setFlameLevel(element, level) {
  if (!element) return;
  element.classList.remove("flame-level-0", "flame-level-1", "flame-level-2", "flame-level-3", "flame-level-4", "flame-level-5");
  element.classList.add(`flame-level-${level}`);
}

function renderActivity() {
  if (!els.activitySummary || !els.activityButton) return;
  prepareActivity();

  const today = localDateKey();
  const todayCount = state.activity.days?.[today] || 0;
  const goal = dailyActivityGoal();
  const todayDone = hasChosenActivityGoal() && todayCount >= goal;
  const progress = Math.min(100, Math.round((todayCount / goal) * 100));
  const streak = calculateActivityStreak();
  const nextMilestone = ACTIVITY_MILESTONES.find((days) => streak < days) || ACTIVITY_MILESTONES.at(-1);
  const daysToGoal = Math.max(0, nextMilestone - streak);
  const currentFlameLevel = flameLevel(todayCount, todayDone, streak);

  els.activityFlame.classList.toggle("is-lit", todayDone);
  els.activityDialogFlame.classList.toggle("is-lit", todayDone);
  setFlameLevel(els.activityFlame, currentFlameLevel);
  setFlameLevel(els.activityDialogFlame, currentFlameLevel);
  els.activityCount.textContent = String(streak);
  els.activityButton.setAttribute(
    "aria-label",
    todayDone ? `Активность: серия ${streak} дней. Открыть детали.` : `Активность: ${Math.min(todayCount, goal)} из ${goal}. Открыть детали.`
  );
  els.activitySummary.textContent = `${Math.min(todayCount, goal)}/${goal} карточек`;
  els.activityProgressFill.style.width = `${progress}%`;
  els.activityProgressText.textContent = todayDone ? "Огонек зажжен сегодня" : `${dailyActivityGoalLabel()} уровень · осталось ${goal - Math.min(todayCount, goal)}`;
  els.activityStreakText.textContent = `Серия: ${streak} дн.`;
  els.activityGoalText.textContent = daysToGoal ? `Цель ${milestoneLabel(nextMilestone)}: еще ${daysToGoal} дн.` : `Цель ${milestoneLabel(nextMilestone)} выполнена`;
  els.activityFreezeText.textContent = `Заморозки: ${state.activity.freezes}`;
}

function recordStudyActivity() {
  prepareActivity();
  const today = localDateKey();
  const goal = dailyActivityGoal();
  const previousCount = Number(state.activity.days?.[today]) || 0;
  const wasComplete = hasChosenActivityGoal() && previousCount >= goal;
  const previousStreak = calculateActivityStreak();
  const previousReviewBucket = Math.floor((state.activity.totalReviews || 0) / FREEZE_REVIEW_STEP);

  state.activity = normalizeActivity(state.activity);
  state.activity.days[today] = previousCount + 1;
  state.activity.totalReviews += 1;
  state.activity.updatedAt = Date.now();

  const isComplete = hasChosenActivityGoal() && state.activity.days[today] >= goal;
  const streak = calculateActivityStreak();
  const reviewBucket = Math.floor(state.activity.totalReviews / FREEZE_REVIEW_STEP);
  const earnedFreezes = Math.max(0, reviewBucket - previousReviewBucket);
  if (earnedFreezes) state.activity.freezes += earnedFreezes;
  const messages = [];

  if (!wasComplete && isComplete) {
    const reachedMilestone = ACTIVITY_MILESTONES.find((days) => previousStreak < days && streak >= days);
    messages.push(reachedMilestone
      ? `Огонек зажегся. Цель достигнута: ${milestoneLabel(reachedMilestone)} подряд.`
      : "Огонек зажегся: день засчитан.");
  }

  if (earnedFreezes) messages.push(`Получена заморозка за ${FREEZE_REVIEW_STEP} карточек.`);
  return messages.join(" ");
}

function openAppDialog(dialog) {
  if (!dialog || dialog.open) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeAppDialog(dialog) {
  if (!dialog?.open) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function openGoalDialog() {
  if (state.language !== "english") return;
  if (!els.goalDialog || hasChosenActivityGoal()) return;
  openAppDialog(els.goalDialog);
}

function closeGoalDialog() {
  closeAppDialog(els.goalDialog);
}

function syncGoalDialog() {
  if (hasChosenActivityGoal()) {
    closeGoalDialog();
    return;
  }
  openGoalDialog();
}

function chooseActivityGoal(mode) {
  if (!DAILY_GOAL_OPTIONS[mode]) return;
  state.activity = normalizeActivity(state.activity);
  state.activity.goalMode = mode;
  state.activity.updatedAt = Date.now();
  persistActivity();
  closeGoalDialog();
  renderActivity();
}

function renderStudy(index = state.currentIndex) {
  const deck = getStudyDeck();

  if (!deck.length) {
    state.currentIndex = 0;
    state.flipped = false;
    els.studyTitle.textContent = state.cards.length ? "В этой папке пока пусто" : "Пока нет карточек";
    els.reviewStatus.textContent = state.cards.length ? folderLabel(state.activeFolder) : "0 карточек";
    els.flashcard.classList.remove("is-flipped");
    els.flashcard.style.transform = "";
    setVisual(els.cardImage, "", "Картинка появится здесь");
    els.cardPhrase.textContent = "No cards yet";
    setTranslation("", true);
    updateSpeechControls();
    renderActivity();
    renderDeck();
    return;
  }

  state.currentIndex = clampStudyIndex(index);
  state.flipped = false;
  const card = currentCard();

  els.studyTitle.textContent = "Карточка";
  els.reviewStatus.textContent = reviewLabel(card);
  els.flashcard.classList.remove("is-flipped");
  els.flashcard.style.transform = "";
  setVisual(els.cardImage, card.imageUrl, "Нет картинки");
  els.cardPhrase.textContent = card.phrase;
  setTranslation(card.translation, true);
  updateSpeechControls();
  renderActivity();
  renderDeck();
}

function renderDeck() {
  els.deckList.replaceChildren();
  renderFolderTree();
  renderBulkFolderOptions();
  updateBulkToolbar();

  const deck = getStudyDeck();
  const summary = deck.length === 1 ? "1 карточка" : `${deck.length} карточек`;
  els.deckSummary.textContent = `${summary} · ${folderLabel(state.activeFolder)}`;

  if (!deck.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = state.cards.length ? "В этой папке нет карточек. Выбери другую папку." : "Колода пустая. Создай первую карточку через AI.";
    els.deckList.append(empty);
    return;
  }

  deck.forEach((card, index) => {
    const item = els.deckItemTemplate.content.firstElementChild.cloneNode(true);
    setVisual(item.querySelector(".deck-thumb"), card.imageUrl, "");
    item.querySelector("h3").textContent = card.phrase;
    item.querySelector("p").textContent = `${cardFolder(card)} · ${reviewLabel(card)} · ${card.word}`;
    item.classList.toggle("is-selecting", state.selectionMode);
    item.classList.toggle("is-selected", state.selectedCardIds.has(card.id));
    const checkbox = item.querySelector(".select-card-checkbox");
    item.querySelector(".deck-select-box").addEventListener("click", (event) => event.stopPropagation());
    checkbox.checked = state.selectedCardIds.has(card.id);
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => toggleCardSelection(card.id, checkbox.checked));
    item.addEventListener("click", () => {
      if (state.selectionMode) {
        toggleCardSelection(card.id, !state.selectedCardIds.has(card.id));
        return;
      }
      renderStudy(index);
      closeDeckDialog();
    });
    item.querySelector(".edit-card-button").addEventListener("click", (event) => {
      event.stopPropagation();
      startEditCard(card.id);
    });
    item.querySelector(".delete-card-button").addEventListener("click", (event) => {
      event.stopPropagation();
      state.cards = state.cards.filter((savedCard) => savedCard.id !== card.id);
      state.selectedCardIds.delete(card.id);
      if (state.editingCardId === card.id) cancelEdit();
      saveCards();
      renderStudy(Math.min(state.currentIndex, state.cards.length - 1));
    });
    els.deckList.append(item);
  });
}

function selectedCards() {
  return state.cards.filter((card) => state.selectedCardIds.has(card.id));
}

function setSelectionMode(enabled) {
  state.selectionMode = Boolean(enabled);
  if (!state.selectionMode) state.selectedCardIds.clear();
  renderDeck();
}

function toggleCardSelection(cardId, selected) {
  if (selected) state.selectedCardIds.add(cardId);
  else state.selectedCardIds.delete(cardId);
  updateBulkToolbar();
  renderDeck();
}

function selectVisibleCards() {
  state.selectionMode = true;
  getStudyDeck().forEach((card) => state.selectedCardIds.add(card.id));
  renderDeck();
}

function renderBulkFolderOptions() {
  const folders = getFolderTreePaths().filter(Boolean);
  const current = normalizeFolderPath(els.bulkFolderSelect.value);
  els.bulkFolderSelect.replaceChildren();

  folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder;
    option.textContent = folder;
    els.bulkFolderSelect.append(option);
  });

  const fallback = state.activeFolder !== "all" ? state.activeFolder : folders[0] || "";
  els.bulkFolderSelect.value = folders.includes(current) ? current : fallback;
}

function updateBulkToolbar() {
  const count = state.selectedCardIds.size;
  els.bulkToolbar.hidden = !state.selectionMode;
  els.selectCardsButton.textContent = state.selectionMode ? "Отменить выбор" : "Выбрать";
  els.selectedCardsCount.textContent = `${count} выбрано`;
  els.moveSelectedCardsButton.disabled = count === 0 || !els.bulkFolderSelect.value;
  els.deleteSelectedCardsButton.disabled = count === 0;
  els.selectVisibleCardsButton.disabled = getStudyDeck().length === 0;
}

function moveSelectedCards() {
  const targetFolder = normalizeFolderPath(els.bulkFolderSelect.value);
  if (!targetFolder || !state.selectedCardIds.size) return;
  const now = Date.now();
  state.cards = state.cards.map((card) => {
    if (!state.selectedCardIds.has(card.id)) return card;
    return { ...card, folderPath: targetFolder, updatedAt: now };
  });
  mergeFolders([targetFolder]);
  state.activeFolder = targetFolder;
  localStorage.setItem(FOLDER_KEY, state.activeFolder);
  const movedCount = state.selectedCardIds.size;
  state.selectedCardIds.clear();
  state.selectionMode = false;
  saveCards();
  renderStudy(0);
  setStatus(`Перемещено карточек: ${movedCount}.`, "ok");
}

function deleteSelectedCards() {
  const count = state.selectedCardIds.size;
  if (!count) return;
  if (!confirm(`Удалить выбранные карточки: ${count}?`)) return;

  const selected = new Set(state.selectedCardIds);
  state.cards = state.cards.filter((card) => !selected.has(card.id));
  if (selected.has(state.editingCardId)) cancelEdit();
  state.selectedCardIds.clear();
  state.selectionMode = false;
  saveCards();
  renderStudy(Math.min(state.currentIndex, state.cards.length - 1));
  setStatus(`Удалено карточек: ${count}.`, "ok");
}

function renderFolderTree() {
  const folders = getFolderTreePaths();
  expandActiveFolderAncestors();
  if (state.activeFolder !== "all" && !folders.includes(state.activeFolder)) {
    state.activeFolder = "all";
  }
  els.folderSummary.textContent = `${folderLabel(state.activeFolder)} · ${getStudyDeck().length}`;
  els.folderTree.replaceChildren();

  const allButton = createFolderTreeButton("all", `Все папки (${state.cards.length})`, 0, false);
  els.folderTree.append(allButton);
  renderFolderChildren("", folders);
}

function renderFolderChildren(parent, folders) {
  folders
    .filter((folder) => parentFolder(folder) === parent)
    .sort((left, right) => left.localeCompare(right, "ru"))
    .forEach((folder) => {
      const count = state.cards.filter((card) => folderDescendantMatches(card, folder)).length;
      const name = folder.split(" / ").at(-1);
      const hasChildren = folders.some((candidate) => parentFolder(candidate) === folder);
      els.folderTree.append(createFolderTreeButton(folder, `${name} (${count})`, folderDepth(folder), hasChildren));
      if (hasChildren && state.expandedFolders.has(folder)) {
        renderFolderChildren(folder, folders);
      }
    });
}

function createFolderTreeButton(folder, label, depth, hasChildren = false) {
  const row = document.createElement("div");
  row.className = folder === "all" ? "folder-tree-row folder-tree-row-single" : "folder-tree-row";
  row.style.setProperty("--depth", depth);
  row.setAttribute("role", "none");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "folder-tree-item";
  button.dataset.folder = folder;
  button.setAttribute("role", "treeitem");
  button.setAttribute("aria-selected", String(state.activeFolder === folder));
  button.setAttribute("aria-expanded", hasChildren ? String(state.expandedFolders.has(folder)) : "false");
  const icon = folder === "all" ? "⌂" : hasChildren && state.expandedFolders.has(folder) ? "▾" : "▸";
  button.innerHTML = `<span class="folder-icon">${icon}</span><span>${label}</span>`;
  button.addEventListener("click", () => {
    if (hasChildren) {
      if (state.expandedFolders.has(folder)) state.expandedFolders.delete(folder);
      else state.expandedFolders.add(folder);
    }
    state.activeFolder = folder;
    localStorage.setItem(FOLDER_KEY, state.activeFolder);
    renderStudy(0);
  });

  row.append(button);
  if (folder !== "all") {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "folder-edit-button";
    editButton.setAttribute("aria-label", `Переименовать папку ${folder}`);
    editButton.textContent = "✎";
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      promptRenameFolder(folder);
    });
    row.append(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "folder-delete-button";
    deleteButton.setAttribute("aria-label", `Удалить папку ${folder}`);
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteFolder(folder);
    });
    row.append(deleteButton);
  }
  return row;
}

function getFolderTreePaths() {
  const paths = new Set();
  getAllFolders().forEach((folder) => {
    const parts = folder.split(" / ").filter(Boolean);
    parts.forEach((_, index) => paths.add(parts.slice(0, index + 1).join(" / ")));
  });
  return [...paths].sort((left, right) => {
    return left.localeCompare(right, "ru");
  });
}

function expandActiveFolderAncestors() {
  let parent = parentFolder(state.activeFolder);
  while (parent) {
    state.expandedFolders.add(parent);
    parent = parentFolder(parent);
  }
}

function flipCard() {
  if (Date.now() < state.ignoreFlipUntil) return;
  if (!state.cards.length) return;
  state.flipped = !state.flipped;
  els.flashcard.classList.toggle("is-flipped", state.flipped);
}

function speak(text) {
  const phrase = String(text || "").trim();
  if (!phrase) return;

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    setStatus("Этот браузер не поддерживает встроенную озвучку.", "warn");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.pitch = 1;

  const voice = window.speechSynthesis
    .getVoices()
    .find((candidate) => candidate.lang?.toLowerCase().startsWith("en"));
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

function speakCurrentCard(event) {
  event?.stopPropagation();
  const card = currentCard();
  speak(card?.phrase);
}

function speakDraft(event) {
  event?.stopPropagation();
  speak(state.draft?.phrase);
}

function updateSpeechControls() {
  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  els.listenCardButton.disabled = !supported || !currentCard();
  els.listenDraftButton.disabled = !supported || !state.draft;
  els.speechStatus.textContent = supported ? "Озвучка браузером" : "Озвучка недоступна";
}

function rateCard(known) {
  const card = currentCard();
  if (!card) return;

  const previousIndex = state.currentIndex;
  const now = Date.now();
  card.attempts += 1;
  card.lastReviewedAt = now;
  if (known) {
    card.correct += 1;
    card.level = Math.min(card.level + 1, REVIEW_INTERVALS.length - 1);
    card.nextReviewAt = now + REVIEW_INTERVALS[card.level];
  } else {
    card.level = Math.max(0, card.level - 2);
    card.nextReviewAt = now + AGAIN_REVIEW_DELAY;
  }
  const activityMessage = recordStudyActivity();
  moveRatedCard(card, known);
  saveCards();
  renderStudy(Math.min(previousIndex, Math.max(0, getStudyDeck().length - 1)));
  if (activityMessage) setStatus(activityMessage, "ok");
}

function moveRatedCard(card, known) {
  const originalIndex = state.cards.findIndex((savedCard) => savedCard.id === card.id);
  if (originalIndex < 0) return;

  state.cards.splice(originalIndex, 1);
  const visibleCards = state.cards.filter(folderMatches);

  if (known) {
    if (!visibleCards.length) {
      state.cards.push(card);
      return;
    }

    const lastVisible = visibleCards[visibleCards.length - 1];
    const lastIndex = state.cards.findIndex((savedCard) => savedCard.id === lastVisible.id);
    state.cards.splice(lastIndex + 1, 0, card);
    return;
  }

  if (!visibleCards.length) {
    state.cards.unshift(card);
    return;
  }

  const targetVisibleIndex = Math.min(visibleCards.length - 1, Math.max(1, Math.floor(visibleCards.length * 0.25)));
  const targetCard = visibleCards[targetVisibleIndex] || visibleCards[0];
  const targetIndex = state.cards.findIndex((savedCard) => savedCard.id === targetCard.id);
  state.cards.splice(Math.max(0, targetIndex), 0, card);
}

function setSwipeVisual(deltaX) {
  const capped = Math.max(-190, Math.min(190, deltaX));
  const rawProgress = Math.min(1, Math.abs(capped) / SWIPE_THRESHOLD);
  const progress = Math.min(1, rawProgress * 1.35);
  els.flashcard.style.transform = `translateX(${capped}px) rotate(${capped / 13}deg)`;
  els.flashcard.style.setProperty("--swipe-left-opacity", capped < 0 ? progress : 0);
  els.flashcard.style.setProperty("--swipe-right-opacity", capped > 0 ? progress : 0);
  els.flashcard.style.setProperty("--swipe-left-bg", capped < 0 ? progress : 0);
  els.flashcard.style.setProperty("--swipe-right-bg", capped > 0 ? progress : 0);
  scheduleSwipeReset();
}

function resetSwipeVisual() {
  clearSwipeReset();
  els.flashcard.classList.remove("is-dragging");
  els.flashcard.style.transform = "";
  els.flashcard.style.setProperty("--swipe-left-opacity", 0);
  els.flashcard.style.setProperty("--swipe-right-opacity", 0);
  els.flashcard.style.setProperty("--swipe-left-bg", 0);
  els.flashcard.style.setProperty("--swipe-right-bg", 0);
}

function clearSwipeReset() {
  if (!state.dragResetTimer) return;
  window.clearTimeout(state.dragResetTimer);
  state.dragResetTimer = 0;
}

function scheduleSwipeReset() {
  clearSwipeReset();
  state.dragResetTimer = window.setTimeout(() => {
    state.drag = null;
    resetSwipeVisual();
  }, 1800);
}

function startSwipe(event) {
  if (!currentCard()) return;
  if (event.target.closest(".listen-button, .translation-chip")) return;
  clearSwipeReset();
  state.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  els.flashcard.setPointerCapture?.(event.pointerId);
}

function moveSwipe(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - state.drag.startX;
  const deltaY = event.clientY - state.drag.startY;
  if (!state.drag.active && Math.abs(deltaX) < 10) return;
  if (!state.drag.active && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) return;

  state.drag.active = true;
  event.preventDefault();
  els.flashcard.classList.add("is-dragging");
  setSwipeVisual(deltaX);
}

function finishSwipe(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - state.drag.startX;
  const wasActive = state.drag.active;
  els.flashcard.releasePointerCapture?.(event.pointerId);
  state.drag = null;
  resetSwipeVisual();

  if (!wasActive || Math.abs(deltaX) < SWIPE_THRESHOLD) return;
  state.ignoreFlipUntil = Date.now() + 450;
  rateCard(deltaX > 0);
}

function cancelSwipe() {
  state.drag = null;
  resetSwipeVisual();
}

async function updateAiStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status request failed");
    const data = await response.json();
    state.aiOnline = Boolean(data.aiReady);
    state.deepSeekOnline = Boolean(data.deepSeekReady);
    state.aiStatusMessage = state.aiOnline ? "AI подключен" : "Ключ не найден";
  } catch {
    state.aiOnline = false;
    state.deepSeekOnline = false;
    state.aiStatusMessage = "Сервер не отвечает";
  }

  els.aiStatusDot.textContent = state.aiStatusMessage;
  els.aiStatusDot.classList.toggle("is-online", state.aiOnline);
  if (els.polishAiStatus) {
    els.polishAiStatus.textContent = state.deepSeekOnline ? "DeepSeek подключен" : "DeepSeek не подключен";
    els.polishAiStatus.classList.toggle("is-online", state.deepSeekOnline);
  }
  return state.aiOnline;
}

function phraseMode() {
  return [...els.phraseModeInputs].find((input) => input.checked)?.value || "ai";
}

function actionButtonLabel() {
  if (state.editingCardId) return "Обновить карточку";
  return phraseMode() === "manual" ? "Создать картинку к моей фразе" : "Создать карточку с AI";
}

function updatePhraseMode() {
  const manual = phraseMode() === "manual";
  els.manualPhraseField.hidden = !manual;
  els.generateButton.textContent = actionButtonLabel();
  els.creatorTitle.textContent = state.editingCardId ? "Изменить карточку" : "Новое слово";
  els.cancelEditButton.hidden = !state.editingCardId;
  setStatus(
    state.editingCardId
      ? "Измени слово, фразу или пожелания к картинке. После генерации нажми «Сохранить обновление»."
      : manual
      ? "Введи слово и свою английскую фразу. AI создаст картинку и русский перевод."
      : "Введи слово, и приложение подберет естественную фразу и картинку.",
    "neutral"
  );
}

async function generateDraft() {
  const word = normalizeWord(els.wordInput.value);
  if (!word) {
    setStatus("Введи одно английское слово.", "warn");
    els.wordInput.focus();
    return;
  }

  const manualPhrase = els.manualPhraseInput.value.trim().replace(/\s+/g, " ");
  const imagePreference = normalizeFreeText(els.imagePreferenceInput.value);
  if (phraseMode() === "manual" && !manualPhrase) {
    setStatus("Введи свою английскую фразу.", "warn");
    els.manualPhraseInput.focus();
    return;
  }

  setLoading(true);
  setStatus(phraseMode() === "manual" ? "Создаю картинку и перевод к твоей фразе." : "Создаю фразу, перевод и картинку. Это может занять немного времени.", "work");

  try {
    const aiReady = await updateAiStatus();
    if (!aiReady) {
      throw new Error(state.aiStatusMessage);
    }

    const draft = await requestAiDraft(word, phraseMode() === "manual" ? manualPhrase : "", imagePreference);
    showDraft(draft);
    setStatus(state.editingCardId ? "Обновленная карточка готова. Проверь и сохрани изменения." : "Карточка готова. Если фраза не нравится, нажми «Другой вариант».", "ok");
  } catch (error) {
    state.draft = null;
    els.draftCard.hidden = true;
    setStatus(`Не получилось создать карточку: ${friendlyError(error.message)}.`, "error");
  } finally {
    setLoading(false);
  }
}

function friendlyError(message = "") {
  if (message.includes("Сервер не отвечает")) return "локальный сервер не запущен";
  if (message.includes("Ключ не найден") || message.includes("OPENAI_API_KEY")) return "ключ не найден в .env";
  if (message.includes("DEEPSEEK_API_KEY")) return "ключ DeepSeek не найден";
  if (message.includes("DeepSeek timeout")) return "DeepSeek слишком долго отвечает";
  if (message.includes("DeepSeek failed")) return "ошибка DeepSeek";
  if (message.includes("fetch failed") || message.includes("Failed to fetch") || message.includes("NetworkError")) return "AI временно не ответил, попробуй еще раз";
  if (message.includes("401")) return "ключ отклонен OpenAI";
  if (message.includes("429")) return "лимит или баланс OpenAI";
  if (message.includes("timeout") || message.includes("aborted") || message.includes("AbortError")) return "AI слишком долго отвечает, попробуй еще раз";
  if (message.includes("Image AI failed") || message.includes("OpenAI image failed")) return "ошибка генерации картинки";
  if (message.includes("Phrase AI failed") || message.includes("OpenAI text failed")) return "ошибка генерации фразы";
  return message || "неизвестная ошибка";
}

async function requestAiDraft(word, phrase = "", imagePreference = "") {
  const existingPhrases = state.cards.map((card) => card.phrase).slice(0, 30);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CREATE_CARD_TIMEOUT);

  const response = await fetch("/api/create-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, phrase, imagePreference, existingPhrases }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "AI unavailable");
  }

  return response.json();
}

function keywordFromPhrase(phrase = "") {
  const stopWords = new Set(["the", "and", "you", "your", "that", "this", "with", "from", "have", "just", "will", "been", "before", "again", "into", "onto"]);
  const word = String(phrase)
    .toLowerCase()
    .match(/[a-z]{3,}/g)
    ?.find((candidate) => !stopWords.has(candidate));
  return normalizeWord(word || "song");
}

function songPhraseKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’`´]/g, "'")
    .replace(/\[[^\]]+\]|\([^)]+\)/g, " ")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueSongDrafts(drafts = []) {
  const existingPhraseKeys = new Set(state.cards.map((card) => songPhraseKey(card.phrase)).filter(Boolean));
  const batchPhraseKeys = new Set();
  const batchWords = new Set();

  return drafts.filter((draft) => {
    const phraseKey = songPhraseKey(draft.phrase);
    const wordKey = normalizeWord(draft.word || keywordFromPhrase(draft.phrase));
    if (!phraseKey || existingPhraseKeys.has(phraseKey) || batchPhraseKeys.has(phraseKey) || batchWords.has(wordKey)) {
      return false;
    }

    batchPhraseKeys.add(phraseKey);
    batchWords.add(wordKey);
    return true;
  });
}

async function requestSongDraftsFromLines(songTitle, lines) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SONG_CARD_TIMEOUT);
  const response = await fetch("/api/create-song-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      songTitle,
      lines,
      existingPhrases: state.cards.map((card) => card.phrase).filter(Boolean).slice(0, 200),
      existingWords: state.cards.map((card) => card.word).filter(Boolean).slice(0, 200),
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "AI unavailable");
  }

  const data = await response.json();
  return Array.isArray(data.cards) ? data.cards : [];
}

async function requestSongDraftsFromTitle(songTitle) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SONG_CARD_TIMEOUT);
  const response = await fetch("/api/create-song-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songTitle }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "AI unavailable");
  }

  const data = await response.json();
  return Array.isArray(data.cards) ? data.cards : [];
}

function showDraft(draft) {
  state.draft = {
    word: normalizeWord(draft.word || els.wordInput.value),
    phrase: draft.phrase,
    translation: draft.translation || "",
    topic: inferTopic(draft),
    folderPath: state.activeFolder !== "all" ? state.activeFolder : defaultFolderForCard(draft),
    scene: draft.scene,
    imagePreference: normalizeFreeText(draft.imagePreference || els.imagePreferenceInput.value),
    imageUrl: draft.imageUrl,
  };

  els.draftPhrase.textContent = state.draft.phrase;
  els.draftTranslation.textContent = state.draft.translation ? `Перевод: ${state.draft.translation}` : "";
  els.draftScene.textContent = state.draft.scene;
  setVisual(els.draftImage, state.draft.imageUrl, "Картинка не создана");
  els.saveDraftButton.textContent = state.editingCardId ? "Сохранить обновление" : "Сохранить";
  els.draftCard.hidden = false;
  updateSpeechControls();
}

function saveDraft() {
  if (!state.draft) return;
  const wasEditing = Boolean(state.editingCardId);
  if (wasEditing) {
    const index = state.cards.findIndex((card) => card.id === state.editingCardId);
    if (index >= 0) {
      state.cards[index] = hydrateCard({
        ...state.cards[index],
        word: state.draft.word,
        phrase: state.draft.phrase,
        translation: state.draft.translation,
        topic: state.draft.topic || inferTopic(state.draft),
        folderPath: state.draft.folderPath,
        scene: state.draft.scene,
        imagePreference: state.draft.imagePreference,
        imageUrl: state.draft.imageUrl,
        updatedAt: Date.now(),
      });
    }
  } else {
    state.cards.unshift(createCard(state.draft));
  }
  saveCards();
  els.creatorForm.reset();
  state.editingCardId = "";
  updatePhraseMode();
  els.draftCard.hidden = true;
  state.draft = null;
  els.saveDraftButton.textContent = "Сохранить";
  setStatus(wasEditing ? "Карточка обновлена." : "Карточка сохранена в колоду.", "ok");
  renderStudy(0);
  updateSpeechControls();
}

function setStatus(message, tone = "neutral") {
  els.generationStatus.textContent = message;
  els.generationStatus.dataset.tone = tone;
}

function setPolishStatus(message, tone = "neutral") {
  if (!els.polishStatus) return;
  els.polishStatus.textContent = message;
  els.polishStatus.dataset.tone = tone;
}

function setLanguage(language) {
  state.language = language === "polish" ? "polish" : "english";
  localStorage.setItem(LANGUAGE_KEY, state.language);
  els.englishView.hidden = state.language !== "english";
  els.polishView.hidden = state.language !== "polish";
  els.englishModeButton.classList.toggle("is-active", state.language === "english");
  els.polishModeButton.classList.toggle("is-active", state.language === "polish");
  els.englishModeButton.setAttribute("aria-current", state.language === "english" ? "page" : "false");
  els.polishModeButton.setAttribute("aria-current", state.language === "polish" ? "page" : "false");
  if (state.language === "polish") closeGoalDialog();
  else syncGoalDialog();
  renderPolish();
  if (state.language === "polish") window.setTimeout(() => ensurePolishExerciseQueue({ silent: true }), 300);
}

function initLanguage() {
  setLanguage(localStorage.getItem(LANGUAGE_KEY) || "english");
}

function parsePolishWordLines(text) {
  return String(text || "")
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+[-–—:]\s+|\s*=\s*/);
      const word = normalizePolishWord(parts[0] || line);
      const translation = normalizeFreeText(parts.slice(1).join(" - "), 80);
      return normalizePolishWordEntry({
        word,
        translation,
        partOfSpeech: word.includes(" ") ? "phrase" : "",
        level: "A1",
        notes: word.includes(" ") ? "устойчивое выражение" : "",
      });
    })
    .filter(Boolean);
}

function shouldExtractPolishWordsWithAi(text = "") {
  const cleanText = String(text || "").trim();
  if (!cleanText) return false;
  const lines = cleanText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const hasSentencePunctuation = /[.!?]/.test(cleanText);
  const hasLongLine = lines.some((line) => line.split(/\s+/).length >= 4 && !/\s[-–—:]\s/.test(line));
  return hasSentencePunctuation || hasLongLine;
}

function formatPolishWordsForInput(words = []) {
  return words
    .map((word) => {
      const entry = normalizePolishWordEntry(word);
      if (!entry) return "";
      return [entry.word, entry.translation].filter(Boolean).join(" - ");
    })
    .filter(Boolean)
    .join("\n");
}

function mergePolishWords(words = []) {
  state.polish = normalizePolishState(state.polish);
  const byKey = new Map(state.polish.words.map((word) => [polishWordKey(word.word), word]));
  words.forEach((entry) => {
    const normalized = normalizePolishWordEntry(entry);
    if (!normalized) return;
    const key = polishWordKey(normalized.word);
    byKey.set(key, { ...(byKey.get(key) || {}), ...normalized });
  });
  state.polish.words = [...byKey.values()].sort((left, right) => left.word.localeCompare(right.word, "pl"));
  state.polish.preparedExercises = [];
  return words.map(normalizePolishWordEntry).filter(Boolean).length;
}

async function addPolishWordsFromInput() {
  const text = els.polishWordsInput.value;
  let words = parsePolishWordLines(text);
  if (!words.length) {
    setPolishStatus("Напиши хотя бы одно польское слово.", "warn");
    els.polishWordsInput.focus();
    return;
  }

  els.addPolishWordsButton.disabled = true;
  try {
    if (shouldExtractPolishWordsWithAi(text)) {
      setPolishStatus("AI разбирает текст на полезные польские слова и связки.", "work");
      await updateAiStatus();
      if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
      const data = await requestPolishApi("/api/polish/extract-words", {
        text,
        existingWords: state.polish.words.map((word) => word.word),
      });
      words = Array.isArray(data.words) ? data.words : [];
    }

    if (!words.length) {
      setPolishStatus("AI не нашел новых слов в этом тексте.", "warn");
      return;
    }

    mergePolishWords(words);
    els.polishWordsInput.value = "";
    saveCards();
    renderPolish();
    setPolishStatus(`Добавлено слов: ${words.length}.`, "ok");
  } catch (error) {
    setPolishStatus(`Не получилось разобрать слова: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.addPolishWordsButton.disabled = false;
  }
}

function removePolishWord(wordId) {
  state.polish.words = normalizePolishState(state.polish).words.filter((word) => word.id !== wordId);
  state.polish.preparedExercises = [];
  saveCards();
  renderPolish();
  setPolishStatus("Слово удалено из польской базы.", "ok");
}

function renderPolish() {
  if (!els.polishDictionarySummary) return;
  state.polish = normalizePolishState(state.polish);
  const wordCount = state.polish.words.length;
  els.polishWordCount.textContent = `${wordCount} слов/фраз`;
  els.polishDictionarySummary.textContent = `${wordCount} слов/фраз · Открыть`;
  els.polishDictionaryPreview.textContent = wordCount
    ? state.polish.words.slice(0, 6).map((word) => word.word).join(", ")
    : "Пока пусто";
  renderPolishDictionary();

  renderPolishExercise();
  renderPolishFeedback();
}

function polishWordType(word = {}) {
  const part = String(word.partOfSpeech || "").toLowerCase();
  if (part.includes("verb") || part.includes("глаг")) return "verb";
  if (part.includes("noun") || part.includes("существ")) return "noun";
  if (part.includes("phrase") || part.includes("фраз") || String(word.word || "").includes(" ")) return "phrase";
  if (part.includes("adj") || part.includes("прилаг")) return "adjective";
  return "other";
}

function polishWordTypeLabel(type) {
  return {
    verb: "Глагол",
    noun: "Существительное",
    phrase: "Фраза",
    adjective: "Прилагательное",
    other: "Другое",
  }[type] || "Другое";
}

function filteredPolishWords() {
  const query = normalizeFreeText(els.polishDictionarySearch?.value || "", 80).toLowerCase();
  const filter = els.polishDictionaryFilter?.value || "all";

  return normalizePolishState(state.polish).words.filter((word) => {
    const type = polishWordType(word);
    const haystack = [word.word, word.translation, word.partOfSpeech, word.gender, word.notes].join(" ").toLowerCase();
    return (filter === "all" || type === filter) && (!query || haystack.includes(query));
  });
}

function renderPolishDictionary() {
  if (!els.polishDictionaryList) return;
  const words = filteredPolishWords();
  const total = state.polish.words.length;
  els.polishDictionaryCount.textContent = `${words.length} из ${total} слов/фраз`;
  els.polishDictionaryList.replaceChildren();

  if (!words.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = total ? "По этому поиску ничего не найдено." : "Словарь пустой.";
    els.polishDictionaryList.append(empty);
    return;
  }

  words.forEach((word) => {
    const row = document.createElement("article");
    row.className = "polish-dictionary-row";
    const type = polishWordType(word);
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(word.word)}</h3>
        <p>${escapeHtml([word.translation, polishWordTypeLabel(type), word.gender].filter(Boolean).join(" · "))}</p>
      </div>
    `;
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-card-button";
    deleteButton.setAttribute("aria-label", `Удалить слово ${word.word}`);
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => removePolishWord(word.id));
    row.append(deleteButton);
    els.polishDictionaryList.append(row);
  });
}

function openPolishDictionary() {
  renderPolishDictionary();
  openAppDialog(els.polishDictionaryDialog);
  window.setTimeout(() => els.polishDictionarySearch?.focus(), 80);
}

function closePolishDictionary() {
  closeAppDialog(els.polishDictionaryDialog);
}

function renderPolishExercise() {
  const exercise = normalizePolishExercise(state.polish.currentExercise || {});
  els.polishExerciseCard.hidden = !exercise;
  if (!exercise) return;

  els.polishPromptRu.textContent = exercise.promptRu;
  els.polishExerciseHint.textContent = exercise.hint || "Используй свои слова из базы. Служебные слова можно добавлять по смыслу.";
  els.polishExerciseHint.classList.toggle("is-hidden", !state.polishHintVisible);
  els.polishExerciseHint.setAttribute("role", "button");
  els.polishExerciseHint.setAttribute("tabindex", "0");
  els.polishExerciseHint.setAttribute("aria-label", state.polishHintVisible ? "Скрыть подсказку" : "Показать подсказку");
  els.polishUsedWords.replaceChildren();
  exercise.usedWords.forEach((word) => {
    const chip = document.createElement("span");
    chip.className = "polish-used-chip";
    chip.textContent = word;
    els.polishUsedWords.append(chip);
  });
}

function togglePolishHint() {
  if (!normalizePolishExercise(state.polish.currentExercise || {})) return;
  state.polishHintVisible = !state.polishHintVisible;
  renderPolishExercise();
}

function renderPolishFeedback() {
  const feedback = state.polish.feedback;
  els.polishFeedback.hidden = !feedback;
  els.polishFeedback.replaceChildren();
  if (!feedback) return;

  const title = document.createElement("h3");
  title.textContent = feedback.isCorrect ? "Похоже, всё правильно" : "Разбор ответа";
  const result = document.createElement("div");
  result.className = "polish-feedback-result";
  result.innerHTML = `
    <p><strong>Твой ответ:</strong> ${escapeHtml(feedback.userAnswer || "")}</p>
    <p><strong>Правильно:</strong> ${escapeHtml(feedback.correctedAnswer || "")}</p>
    <p><strong>Оценка:</strong> ${Math.round(Number(feedback.score) || 0)}%</p>
  `;
  els.polishFeedback.append(title, result);

  const mistakes = Array.isArray(feedback.mistakes) ? feedback.mistakes : [];
  if (mistakes.length) {
    const list = document.createElement("ul");
    list.className = "polish-mistake-list";
    mistakes.forEach((mistake) => {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${escapeHtml(mistake.correct || "Исправление")}</strong><br>${escapeHtml(mistake.reasonRu || "")}`;
      list.append(item);
    });
    els.polishFeedback.append(list);
  }

  if (feedback.explanationRu) {
    const note = document.createElement("p");
    note.textContent = feedback.explanationRu;
    els.polishFeedback.append(note);
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function requestPolishApi(path, payload) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POLISH_AI_TIMEOUT);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "DeepSeek unavailable");
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError" || attempt === 1) throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError || new Error("fetch failed");
}

async function suggestPolishWords() {
  els.suggestPolishWordsButton.disabled = true;
  setPolishStatus("AI подбирает 10 базовых слов и вставит их в поле.", "work");
  try {
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const data = await requestPolishApi("/api/polish/suggest-words", {
      existingWords: state.polish.words.map((word) => word.word),
      count: 10,
    });
    const words = Array.isArray(data.words) ? data.words : [];
    const suggestedText = formatPolishWordsForInput(words);
    els.polishWordsInput.value = suggestedText;
    els.polishWordsInput.focus();
    setPolishStatus(words.length ? "Проверь слова в поле и нажми «Добавить мои слова»." : "AI не нашел новых слов. Попробуй позже.", words.length ? "ok" : "warn");
  } catch (error) {
    setPolishStatus(`Не получилось добавить слова: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.suggestPolishWordsButton.disabled = false;
  }
}

function choosePolishExerciseWords(count = 7) {
  const words = normalizePolishState(state.polish).words;
  const recentUsed = new Set(
    state.polish.exercises
      .slice(0, 4)
      .flatMap((exercise) => exercise.usedWords || [])
      .map(polishWordKey)
  );
  const scored = words.map((word) => ({
    word,
    score: (recentUsed.has(polishWordKey(word.word)) ? 0 : 100) + Math.random() * 40,
  }));
  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, Math.max(3, Math.min(count, words.length))).map((item) => item.word);
}

function polishExerciseSettings() {
  return {
    count: Number(els.polishExerciseCount.value) || 10,
    mode: els.polishExerciseMode.value || "medium",
  };
}

function polishExerciseMatchesSettings(exercise, count, mode) {
  const normalized = normalizePolishExercise(exercise);
  return normalized && normalized.mode === mode && normalized.targetCount === count;
}

function takePreparedPolishExercise(count, mode) {
  state.polish = normalizePolishState(state.polish);
  const index = state.polish.preparedExercises.findIndex((exercise) => polishExerciseMatchesSettings(exercise, count, mode));
  if (index === -1) return null;
  const [exercise] = state.polish.preparedExercises.splice(index, 1);
  return normalizePolishExercise(exercise);
}

function recentPolishExercisesForAi() {
  return [...state.polish.exercises, ...state.polish.preparedExercises]
    .slice(0, 10)
    .map((exercise) => ({
      promptRu: exercise.promptRu,
      expectedPl: exercise.expectedPl,
      usedWords: exercise.usedWords,
    }));
}

async function fetchPolishExercise(count, mode) {
  const data = await requestPolishApi("/api/polish/create-exercise", {
    words: state.polish.words.slice(0, 200),
    count,
    mode,
    recentExercises: recentPolishExercisesForAi(),
  });
  return normalizePolishExercise({ ...data.exercise, mode, targetCount: count });
}

function activatePolishExercise(exercise) {
  const normalized = normalizePolishExercise(exercise);
  if (!normalized) throw new Error("AI returned no exercise");
  state.polish.currentExercise = normalized;
  state.polishHintVisible = false;
  state.polish.feedback = null;
  state.polish.exercises = [normalized, ...state.polish.exercises.filter((item) => item.id !== normalized.id)].slice(0, 30);
  els.polishAnswerInput.value = "";
  saveCards();
  renderPolish();
}

async function ensurePolishExerciseQueue({ silent = true } = {}) {
  state.polish = normalizePolishState(state.polish);
  if (state.polishPrefetching || state.polish.words.length < 3) return;

  const { count, mode } = polishExerciseSettings();
  const matchingQueue = state.polish.preparedExercises.filter((exercise) => polishExerciseMatchesSettings(exercise, count, mode));
  state.polish.preparedExercises = matchingQueue.slice(0, POLISH_PREFETCH_TARGET);
  if (matchingQueue.length >= POLISH_PREFETCH_TARGET) return;

  state.polishPrefetching = true;
  try {
    await updateAiStatus();
    if (!state.deepSeekOnline) return;
    if (!silent) setPolishStatus("AI готовит задания заранее.", "work");
    while (state.polish.preparedExercises.length < POLISH_PREFETCH_TARGET) {
      const exercise = await fetchPolishExercise(count, mode);
      const currentSettings = polishExerciseSettings();
      if (currentSettings.count !== count || currentSettings.mode !== mode) break;
      if (!exercise) break;
      state.polish.preparedExercises = [...state.polish.preparedExercises, exercise].slice(0, POLISH_PREFETCH_TARGET);
      saveCards();
    }
    if (!silent) setPolishStatus(`Готово заранее: ${state.polish.preparedExercises.length}.`, "ok");
  } catch (error) {
    if (!silent) setPolishStatus(`Не получилось подготовить задания заранее: ${friendlyError(error.message)}.`, "warn");
  } finally {
    state.polishPrefetching = false;
  }
}

async function createPolishExercise() {
  state.polish = normalizePolishState(state.polish);
  if (state.polish.words.length < 3) {
    setPolishStatus("Для задания нужно хотя бы 3 польских слова в базе.", "warn");
    return;
  }

  els.createPolishExerciseButton.disabled = true;
  const { count, mode } = polishExerciseSettings();
  try {
    const queuedExercise = takePreparedPolishExercise(count, mode);
    if (queuedExercise) {
      activatePolishExercise(queuedExercise);
      setPolishStatus("Задание готово из очереди. Следующие готовятся в фоне.", "ok");
      ensurePolishExerciseQueue();
      return;
    }

    setPolishStatus("AI создает первое задание. Следующие подготовит заранее.", "work");
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const exercise = await fetchPolishExercise(count, mode);
    activatePolishExercise(exercise);
    setPolishStatus("Задание готово. Следующие готовятся заранее.", "ok");
    ensurePolishExerciseQueue();
  } catch (error) {
    setPolishStatus(`Не получилось создать задание: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.createPolishExerciseButton.disabled = false;
  }
}

async function checkPolishAnswer() {
  const exercise = normalizePolishExercise(state.polish.currentExercise || {});
  const answer = normalizeFreeText(els.polishAnswerInput.value, 320);
  if (!exercise) {
    setPolishStatus("Сначала создай задание.", "warn");
    return;
  }
  if (!answer) {
    setPolishStatus("Напиши свой польский ответ.", "warn");
    els.polishAnswerInput.focus();
    return;
  }

  els.checkPolishAnswerButton.disabled = true;
  setPolishStatus("AI проверяет ответ и разбирает ошибки.", "work");
  try {
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const data = await requestPolishApi("/api/polish/check-answer", {
      exercise,
      answer,
      words: state.polish.words,
    });
    state.polish.feedback = {
      userAnswer: answer,
      isCorrect: Boolean(data.isCorrect),
      score: Math.max(0, Math.min(100, Number(data.score) || 0)),
      correctedAnswer: normalizeFreeText(data.correctedAnswer || exercise.expectedPl, 320),
      mistakes: Array.isArray(data.mistakes) ? data.mistakes.slice(0, 8) : [],
      explanationRu: normalizeFreeText(data.explanationRu || "", 360),
    };
    saveCards();
    renderPolish();
    setPolishStatus(state.polish.feedback.isCorrect ? "Ответ засчитан." : "Разбор готов.", "ok");
    ensurePolishExerciseQueue();
  } catch (error) {
    setPolishStatus(`Не получилось проверить ответ: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.checkPolishAnswerButton.disabled = false;
  }
}

function setLoading(isLoading) {
  els.generateButton.disabled = isLoading;
  els.regenerateButton.disabled = isLoading;
  els.saveDraftButton.disabled = isLoading;
  els.generateButton.textContent = isLoading
    ? "Создаю..."
    : actionButtonLabel();
}

function setPhraseMode(mode) {
  els.phraseModeInputs.forEach((input) => {
    input.checked = input.value === mode;
  });
  updatePhraseMode();
}

function startEditCard(cardId) {
  const card = state.cards.find((savedCard) => savedCard.id === cardId);
  if (!card) return;
  state.editingCardId = card.id;
  els.wordInput.value = card.word || "";
  els.manualPhraseInput.value = card.phrase || "";
  els.imagePreferenceInput.value = card.imagePreference || "";
  setPhraseMode("manual");
  els.draftCard.hidden = true;
  state.draft = null;
  setStatus("Редактирование включено. Измени фразу или пожелания к картинке, затем создай обновление.", "work");
  document.querySelector(".creator")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  state.editingCardId = "";
  state.draft = null;
  els.creatorForm.reset();
  els.draftCard.hidden = true;
  els.saveDraftButton.textContent = "Сохранить";
  updatePhraseMode();
  setStatus("Редактирование отменено.", "neutral");
}

async function openProfile(profileId) {
  const cleanProfileId = normalizeProfileId(profileId);
  if (!cleanProfileId) {
    setStatus("Введи код профиля.", "warn");
    return;
  }

  rememberProfileId(cleanProfileId);
  loadLocalCards();
  renderStudy(0);
  syncGoalDialog();
  setStatus(`Открыт профиль ${state.profileId}.`, "ok");

  try {
    await loadServerCards();
  } catch {
    setStatus("Профиль открыт локально. Сервер синхронизации недоступен.", "warn");
  }
  closeSettingsDialog();
}

function createNewProfile() {
  openProfile(generateProfileId());
}

function createFolder() {
  const folder = normalizeFolderPath(els.folderNameInput.value);
  if (!folder) {
    setStatus("Введи название папки. Для вложенности используй /.", "warn");
    return;
  }

  mergeFolders([folder]);
  state.activeFolder = folder;
  let parent = parentFolder(folder);
  while (parent) {
    state.expandedFolders.add(parent);
    parent = parentFolder(parent);
  }
  localStorage.setItem(FOLDER_KEY, state.activeFolder);
  els.folderNameInput.value = "";
  saveCards();
  renderStudy(0);
  setStatus(`Папка «${folder}» создана.`, "ok");
}

function promptRenameFolder(folder) {
  const oldFolder = normalizeFolderPath(folder);
  if (!oldFolder || oldFolder === "all") return;
  const newFolder = normalizeFolderPath(window.prompt("Новое название папки", oldFolder));
  renameFolder(oldFolder, newFolder);
}

function renameFolder(oldFolder, newFolder) {
  if (!newFolder) {
    setStatus("Введи новое название папки.", "warn");
    return;
  }
  if (newFolder === oldFolder) return;

  state.cards = state.cards.map((card) => {
    const folder = cardFolder(card);
    if (folder !== oldFolder && !folder.startsWith(`${oldFolder} / `)) return card;
    return {
      ...card,
      folderPath: `${newFolder}${folder.slice(oldFolder.length)}`,
      updatedAt: Date.now(),
    };
  });
  state.folders = getAllFolders()
    .map((folder) => (folder === oldFolder || folder.startsWith(`${oldFolder} / `) ? `${newFolder}${folder.slice(oldFolder.length)}` : folder));
  state.activeFolder = newFolder;
  let parent = parentFolder(newFolder);
  while (parent) {
    state.expandedFolders.add(parent);
    parent = parentFolder(parent);
  }
  localStorage.setItem(FOLDER_KEY, state.activeFolder);
  saveCards();
  renderStudy(0);
  setStatus(`Папка переименована в «${newFolder}».`, "ok");
}

function deleteFolder(folderPath) {
  const folder = normalizeFolderPath(folderPath);
  if (!folder || folder === "all") return;

  const matchesDeletedFolder = (candidate) => candidate === folder || candidate.startsWith(`${folder} / `);
  const deletedCards = state.cards.filter((card) => matchesDeletedFolder(cardFolder(card)));
  const deletedFolders = getAllFolders().filter(matchesDeletedFolder);
  const message = deletedCards.length
    ? `Удалить папку «${folder}», вложенные папки и все карточки внутри? Карточек: ${deletedCards.length}.`
    : `Удалить пустую папку «${folder}» и ее вложенные папки?`;

  if (!confirm(message)) return;

  const deletedCardIds = new Set(deletedCards.map((card) => card.id));
  state.cards = state.cards.filter((card) => !deletedCardIds.has(card.id));
  state.folders = getAllFolders().filter((candidate) => !matchesDeletedFolder(candidate));
  deletedFolders.forEach((deletedFolder) => {
    state.expandedFolders.delete(deletedFolder);
    state.songExpandedFolders.delete(deletedFolder);
  });
  deletedCardIds.forEach((id) => state.selectedCardIds.delete(id));

  if (deletedCardIds.has(state.editingCardId)) {
    cancelEdit();
  }
  if (state.activeFolder !== "all" && matchesDeletedFolder(state.activeFolder)) {
    state.activeFolder = "all";
    localStorage.setItem(FOLDER_KEY, state.activeFolder);
  }
  if (matchesDeletedFolder(state.songParentFolder)) {
    state.songParentFolder = SONG_ROOT_FOLDER;
  }

  saveCards();
  renderStudy(0);
  setSongStatus(`Папка удалена: ${folder}.`, "ok");
  setStatus(`Папка удалена: ${folder}.`, "ok");
}

function openDeckDialog() {
  openAppDialog(els.deckDialog);
}

function closeDeckDialog() {
  state.selectionMode = false;
  state.selectedCardIds.clear();
  renderDeck();
  closeAppDialog(els.deckDialog);
}

function openSettingsDialog() {
  openAppDialog(els.settingsDialog);
}

function closeSettingsDialog() {
  closeAppDialog(els.settingsDialog);
}

function openActivityDialog() {
  renderActivity();
  openAppDialog(els.activityDialog);
}

function closeActivityDialog() {
  closeAppDialog(els.activityDialog);
}

function updateSongLyricsLinks() {
  // Kept for older call sites; song search now happens through DeepSeek.
}

function songTargetFolder() {
  return normalizeFolderPath(state.songParentFolder) || SONG_ROOT_FOLDER;
}

function getSongFolderTreePaths() {
  const paths = new Set([SONG_ROOT_FOLDER]);
  getAllFolders()
    .filter((folder) => folder === SONG_ROOT_FOLDER || folder.startsWith(`${SONG_ROOT_FOLDER} / `))
    .forEach((folder) => {
      const parts = folder.split(" / ").filter(Boolean);
      parts.forEach((_, index) => paths.add(parts.slice(0, index + 1).join(" / ")));
    });

  const parent = normalizeFolderPath(state.songParentFolder) || SONG_ROOT_FOLDER;
  parent.split(" / ").filter(Boolean).forEach((_, index, parts) => {
    paths.add(parts.slice(0, index + 1).join(" / "));
  });

  return [...paths].sort((left, right) => left.localeCompare(right, "ru"));
}

function expandSongFolderAncestors(folder) {
  let parent = parentFolder(folder);
  while (parent) {
    state.songExpandedFolders.add(parent);
    parent = parentFolder(parent);
  }
}

function renderSongFolderTree() {
  const folders = getSongFolderTreePaths();
  if (!state.songParentFolder || !folders.includes(state.songParentFolder)) {
    state.songParentFolder = SONG_ROOT_FOLDER;
  }
  expandSongFolderAncestors(state.songParentFolder);
  els.songFolderPreview.textContent = `Выбрано: ${songTargetFolder()}`;
  els.songFolderTree.replaceChildren();
  renderSongFolderChildren("", folders);
}

function renderSongFolderChildren(parent, folders) {
  folders
    .filter((folder) => parentFolder(folder) === parent)
    .sort((left, right) => left.localeCompare(right, "ru"))
    .forEach((folder) => {
      const count = state.cards.filter((card) => folderDescendantMatches(card, folder)).length;
      const name = folder.split(" / ").at(-1);
      const hasChildren = folders.some((candidate) => parentFolder(candidate) === folder);
      const label = `${name} (${count})`;
      els.songFolderTree.append(createSongFolderTreeButton(folder, label, folderDepth(folder) - 1, hasChildren));
      if (hasChildren && state.songExpandedFolders.has(folder)) {
        renderSongFolderChildren(folder, folders);
      }
    });
}

function createSongFolderTreeButton(folder, label, depth, hasChildren = false) {
  const row = document.createElement("div");
  row.className = "folder-tree-row";
  row.style.setProperty("--depth", Math.max(depth, 0));
  row.setAttribute("role", "none");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "folder-tree-item";
  button.dataset.folder = folder;
  button.setAttribute("role", "treeitem");
  button.setAttribute("aria-selected", String(state.songParentFolder === folder));
  button.setAttribute("aria-expanded", hasChildren ? String(state.songExpandedFolders.has(folder)) : "false");
  const expanded = state.songExpandedFolders.has(folder);
  const icon = hasChildren ? (expanded ? "▾" : "▸") : "•";
  const action = hasChildren ? (expanded ? "Скрыть" : "Раскрыть") : "Выбрать";
  button.innerHTML = `<span class="folder-icon">${icon}</span><span>${label}</span><span class="folder-open-label">${action}</span>`;
  button.addEventListener("click", () => {
    if (hasChildren) {
      if (expanded) state.songExpandedFolders.delete(folder);
      else state.songExpandedFolders.add(folder);
    }
    state.songParentFolder = folder;
    renderSongFolderTree();
  });

  row.append(button);
  return row;
}

function syncSongFolderFromTitle() {
  const song = parseSongTitle(els.songTitleInput.value);
  const suggestion = song.artist && song.title ? `${song.artist} / ${song.title}` : song.title || "Новая папка";
  els.songFolderInput.placeholder = `Новая подпапка, например: ${suggestion}`;
  renderSongFolderTree();
}

function addNestedSongFolder() {
  const parent = normalizeFolderPath(state.songParentFolder) || SONG_ROOT_FOLDER;
  const folderName = normalizeFolderPath(els.songFolderInput.value);
  if (!folderName) {
    setSongStatus("Введи название новой подпапки рядом с плюсиком.", "warn");
    els.songFolderInput.focus();
    return;
  }

  const folder = normalizeFolderPath(`${parent} / ${folderName}`);
  mergeFolders([SONG_ROOT_FOLDER, parent, folder]);
  state.songParentFolder = folder;
  state.songExpandedFolders.add(parent);
  expandSongFolderAncestors(folder);
  els.songFolderInput.value = "";
  saveCards();
  renderSongFolderTree();
  setSongStatus(`Папка создана и выбрана: ${folder}.`, "ok");
}

function openSongDialog() {
  state.songParentFolder = SONG_ROOT_FOLDER;
  state.songExpandedFolders.add(SONG_ROOT_FOLDER);
  els.songFolderInput.value = "";
  renderSongCandidates([]);
  syncSongFolderFromTitle();
  updateSongLyricsLinks();
  setSongStatus("Выбери готовую папку внутри «Только песни». Чтобы создать новую, введи название рядом с плюсиком.", "neutral");
  openAppDialog(els.songDialog);
}

function closeSongDialog() {
  closeAppDialog(els.songDialog);
}

function setSongStatus(message, tone = "neutral") {
  els.songStatus.textContent = message;
  els.songStatus.dataset.tone = tone;
}

function renderSongCandidates(candidates = []) {
  els.songCandidates.replaceChildren();
  els.songCandidates.hidden = !candidates.length;

  candidates.forEach((candidate) => {
    const title = [candidate.artist, candidate.title].filter(Boolean).join(" — ");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "song-candidate";
    button.innerHTML = `<strong>${title}</strong><span>${candidate.reason || "Похоже на эту песню."}</span>`;
    button.addEventListener("click", async () => {
      els.songTitleInput.value = title;
      els.songCandidates.hidden = true;
      syncSongFolderFromTitle();
      setSongStatus("Песня выбрана. DeepSeek готовит карточки по смыслу песни без текста песни.", "work");
      await createSongCards(null, { autoFolder: true });
    });
    els.songCandidates.append(button);
  });
}

async function findSongWithAi() {
  if (!els.songDialog.open) openSongDialog();
  const query = normalizeFreeText(els.songTitleInput.value || els.songTextInput.value, 240);
  if (!query) {
    setSongStatus("Напиши примерное название, исполнителя или короткую подсказку.", "warn");
    els.songTitleInput.focus();
    return;
  }

  els.songLyricsLink.disabled = true;
  els.songSearchButton.disabled = true;
  setSongStatus("Ищу песню через AI. Полный текст песни не запрашиваю.", "work");

  try {
    const response = await fetch("/api/song-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "DeepSeek unavailable");
    }

    const data = await response.json();
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    renderSongCandidates(candidates);
    setSongStatus(candidates.length ? "Выбери подходящую песню из вариантов." : "AI не нашел уверенных вариантов. Уточни название или исполнителя.", candidates.length ? "ok" : "warn");
  } catch (error) {
    setSongStatus(`Не получилось найти песню: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.songLyricsLink.disabled = false;
    els.songSearchButton.disabled = false;
  }
}

function splitSongLines(text) {
  const seenPhrases = new Set();
  const seenWords = new Set();

  return String(text || "")
    .split(/\n+|[.;!?]+/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.split(/\s+/).length >= 3)
    .filter((line) => {
      const phraseKey = songPhraseKey(line);
      const wordKey = keywordFromPhrase(line);
      if (!phraseKey || seenPhrases.has(phraseKey) || seenWords.has(wordKey)) return false;
      seenPhrases.add(phraseKey);
      seenWords.add(wordKey);
      return true;
    })
    .slice(0, MAX_SONG_LINES);
}

function songAutoFolderPath(songTitle) {
  const song = parseSongTitle(songTitle);
  const parts = [SONG_ROOT_FOLDER, song.artist || "AI песни", song.title || songTitle || "Новая песня"]
    .map((part) => normalizeFolderPath(part))
    .filter(Boolean);
  return normalizeFolderPath(parts.join(" / "));
}

async function createSongCards(event, options = {}) {
  event?.preventDefault();
  const songTitle = normalizeFreeText(els.songTitleInput.value, 120);
  const pastedLines = splitSongLines(els.songTextInput.value);
  const folderPath = options.autoFolder && songTitle && !pastedLines.length ? songAutoFolderPath(songTitle) : songTargetFolder();

  if (!songTitle && !pastedLines.length) {
    setSongStatus("Введи название песни или вставь строки.", "warn");
    return;
  }
  if (!folderPath || folderPath === SONG_ROOT_FOLDER) {
    setSongStatus("Выбери папку внутри «Только песни» или создай новую плюсиком.", "warn");
    return;
  }

  els.createSongButton.disabled = true;
  setSongStatus(pastedLines.length
    ? `Создаю до ${pastedLines.length} карточек одним пакетом. Повторы слов пропускаю.`
    : "Создаю оригинальные учебные фразы по названию песни.",
  "work");

  try {
    const aiReady = await updateAiStatus();
    if (!aiReady) throw new Error(state.aiStatusMessage);
    if (options.autoFolder) {
      mergeFolders([SONG_ROOT_FOLDER, folderPath]);
      state.songParentFolder = folderPath;
      expandSongFolderAncestors(folderPath);
    }

    const drafts = pastedLines.length
      ? await requestSongDraftsFromLines(songTitle, pastedLines)
      : await requestSongDraftsFromTitle(songTitle);
    const uniqueDrafts = uniqueSongDrafts(drafts);

    if (!uniqueDrafts.length) {
      setSongStatus("Новые карточки не созданы: эти строки или слова уже есть в колоде.", "warn");
      return;
    }

    const now = Date.now();
    const cards = uniqueDrafts.map((draft, index) => hydrateCard({
      id: crypto.randomUUID(),
      word: draft.word || keywordFromPhrase(draft.phrase),
      phrase: draft.phrase,
      translation: draft.translation || "",
      topic: "general",
      folderPath,
      scene: draft.scene || "",
      imagePreference: songTitle ? `Song study folder: ${songTitle}. Vertical phone-first image.` : "Vertical phone-first image.",
      imageUrl: draft.imageUrl || "",
      createdAt: now + index,
      updatedAt: now + index,
    }));

    state.cards = [...cards, ...state.cards];
    mergeFolders([SONG_ROOT_FOLDER, folderPath]);
    state.activeFolder = folderPath;
    localStorage.setItem(FOLDER_KEY, state.activeFolder);
    saveCards();
    renderStudy(0);
    closeSongDialog();
    setStatus(`Создано карточек по песне: ${cards.length}.`, "ok");
  } catch (error) {
    setSongStatus(`Не получилось создать карточки: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.createSongButton.disabled = false;
  }
}

els.creatorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  generateDraft();
});
els.phraseModeInputs.forEach((input) => input.addEventListener("change", updatePhraseMode));
els.regenerateButton.addEventListener("click", generateDraft);
els.saveDraftButton.addEventListener("click", saveDraft);
els.cancelEditButton.addEventListener("click", cancelEdit);
els.listenCardButton.addEventListener("click", speakCurrentCard);
els.listenDraftButton.addEventListener("click", speakDraft);
els.cardTranslation.addEventListener("click", toggleTranslation);
els.cardTranslation.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  toggleTranslation(event);
});
els.flashcard.addEventListener("click", flipCard);
els.againButton.addEventListener("click", () => rateCard(false));
els.gotItButton.addEventListener("click", () => rateCard(true));
els.flashcard.addEventListener("pointerdown", startSwipe);
els.flashcard.addEventListener("pointermove", moveSwipe);
els.flashcard.addEventListener("pointerup", finishSwipe);
els.flashcard.addEventListener("pointercancel", cancelSwipe);
els.flashcard.addEventListener("lostpointercapture", cancelSwipe);
window.addEventListener("pointerup", finishSwipe);
window.addEventListener("pointercancel", cancelSwipe);
els.loadProfileButton.addEventListener("click", () => openProfile(els.profileInput.value));
els.newProfileButton.addEventListener("click", createNewProfile);
els.createFolderButton.addEventListener("click", createFolder);
els.activityButton.addEventListener("click", openActivityDialog);
els.closeActivityButton.addEventListener("click", closeActivityDialog);
els.changeGoalButton.addEventListener("click", () => {
  state.activity.goalMode = "";
  closeActivityDialog();
  openGoalDialog();
});
els.activityDialog.addEventListener("click", (event) => {
  if (event.target === els.activityDialog) closeActivityDialog();
});
els.goalOptionButtons.forEach((button) => {
  button.addEventListener("click", () => chooseActivityGoal(button.dataset.goalMode));
});
els.openSettingsButton.addEventListener("click", openSettingsDialog);
els.closeSettingsButton.addEventListener("click", closeSettingsDialog);
els.settingsDialog.addEventListener("click", (event) => {
  if (event.target === els.settingsDialog) closeSettingsDialog();
});
els.openDeckButton.addEventListener("click", openDeckDialog);
els.openDeckSummaryButton.addEventListener("click", openDeckDialog);
els.closeDeckButton.addEventListener("click", closeDeckDialog);
els.selectCardsButton.addEventListener("click", () => setSelectionMode(!state.selectionMode));
els.cancelSelectionButton.addEventListener("click", () => setSelectionMode(false));
els.selectVisibleCardsButton.addEventListener("click", selectVisibleCards);
els.bulkFolderSelect.addEventListener("change", updateBulkToolbar);
els.moveSelectedCardsButton.addEventListener("click", moveSelectedCards);
els.deleteSelectedCardsButton.addEventListener("click", deleteSelectedCards);
els.deckDialog.addEventListener("click", (event) => {
  if (event.target === els.deckDialog) closeDeckDialog();
});
els.openSongButton.addEventListener("click", openSongDialog);
els.songSearchButton.addEventListener("click", () => {
  openSongDialog();
  els.songTitleInput.focus();
});
els.songLyricsLink.addEventListener("click", findSongWithAi);
els.songTitleInput.addEventListener("input", () => {
  syncSongFolderFromTitle();
  renderSongCandidates([]);
});
els.songFolderInput.addEventListener("input", renderSongFolderTree);
els.addSongFolderButton.addEventListener("click", addNestedSongFolder);
els.closeSongButton.addEventListener("click", closeSongDialog);
els.songDialog.addEventListener("click", (event) => {
  if (event.target === els.songDialog) closeSongDialog();
});
els.songForm.addEventListener("submit", createSongCards);

els.clearButton.addEventListener("click", () => {
  if (!state.cards.length) return;
  if (!confirm("Удалить все карточки?")) return;
  state.cards = [];
  saveCards();
  renderStudy(0);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
  els.installButton.hidden = false;
});

els.installButton.addEventListener("click", async () => {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  els.installButton.hidden = true;
});

els.englishModeButton.addEventListener("click", () => setLanguage("english"));
els.polishModeButton.addEventListener("click", () => setLanguage("polish"));
els.addPolishWordsButton.addEventListener("click", addPolishWordsFromInput);
els.suggestPolishWordsButton.addEventListener("click", suggestPolishWords);
els.openPolishDictionaryButton.addEventListener("click", openPolishDictionary);
els.closePolishDictionaryButton.addEventListener("click", closePolishDictionary);
els.polishDictionarySearch.addEventListener("input", renderPolishDictionary);
els.polishDictionaryFilter.addEventListener("change", renderPolishDictionary);
els.polishDictionaryDialog.addEventListener("click", (event) => {
  if (event.target === els.polishDictionaryDialog) closePolishDictionary();
});
els.polishExerciseCount.addEventListener("change", () => {
  state.polish = normalizePolishState(state.polish);
  state.polish.preparedExercises = [];
  saveCards();
  setPolishStatus("Настройки изменены. AI подготовит новую очередь.", "work");
  ensurePolishExerciseQueue({ silent: true });
});
els.polishExerciseMode.addEventListener("change", () => {
  state.polish = normalizePolishState(state.polish);
  state.polish.preparedExercises = [];
  saveCards();
  setPolishStatus("Режим изменен. AI подготовит новую очередь.", "work");
  ensurePolishExerciseQueue({ silent: true });
});
els.createPolishExerciseButton.addEventListener("click", createPolishExercise);
els.checkPolishAnswerButton.addEventListener("click", checkPolishAnswer);
els.polishExerciseHint.addEventListener("click", togglePolishHint);
els.polishExerciseHint.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  togglePolishHint();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

initProfile();
initLanguage();
loadLocalCards();
renderStudy(0);
renderPolish();
syncGoalDialog();
loadServerCards().catch(() => {});
updateAiStatus();
updateSpeechControls();
updatePhraseMode();
updateSongLyricsLinks();
setInterval(updateAiStatus, 10000);

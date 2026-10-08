const STORAGE_KEY = "action-cards:v2";
const PROFILE_KEY = "action-cards:profile:v1";
const PROFILE_COOKIE = "action_cards_profile";
const FOLDER_KEY = "action-cards:folder:v1";
const ACTIVITY_KEY = "action-cards:activity:v1";
const LANGUAGE_KEY = "action-cards:language:v1";
const POLISH_KEY = "action-cards:polish:v1";
const ENGLISH_TRAINER_KEY = "action-cards:english-trainer:v1";
const STUDY_SETTINGS_KEY = "action-cards:study-settings:v1";
const DEFAULT_CARDS_URL = "default-cards.json?v=69";
const STARTER_PACKS_KEY = "action-cards:starter-packs:v1";
const BASIC_ACTIONS_PACK = "basic-actions-v1";
const BASIC_ACTIONS_FOLDER = "Стартовые / Действия с предметами";
const STARTER_PACKS = [
  { id: BASIC_ACTIONS_PACK, prefix: "basic-action-" },
  { id: "basic-questions-v1", prefix: "basic-question-" },
];
const BASIC_ACTION_MOTIONS = new Map([
  ["Pick up the phone.", "arrow-up"],
  ["Put the cup down on the table.", "arrow-down"],
  ["Move the book aside.", "arrow-right"],
  ["Move the box over here.", "arrow-down-left"],
  ["Put the key in your pocket.", "arrow-down-to-line"],
  ["Take the key out of your pocket.", "arrow-up-from-line"],
  ["Give me the pen.", "arrow-left"],
  ["Lift the box up.", "arrow-up"],
  ["Lower the box slowly.", "arrow-down"],
  ["Tilt the bottle slightly.", "rotate-cw"],
  ["Keep the bottle upright.", "arrow-up"],
  ["Bring the phone closer.", "arrow-down-left"],
  ["Move the phone farther away.", "arrow-up-right"],
  ["Give the bottle a good shake.", "move-horizontal"],
  ["Be careful! Don’t drop the glass.", "circle-slash"],
  ["Carry the laptop carefully.", "arrow-right"],
  ["Set the plate down gently.", "arrow-down"],
  ["Turn the phone around.", "rotate-cw"],
  ["Turn the cup upside down.", "rotate-cw"],
  ["Leave the keys there.", "pause"],
].map(([phrase, icon]) => [songPhraseKey(phrase), icon]));
const SONG_ROOT_FOLDER = "Только песни";
const AGAIN_REVIEW_DELAY = 45 * 1000;
const CREATE_CARD_TIMEOUT = 140 * 1000;
const SONG_CARD_TIMEOUT = 480 * 1000;
const POLISH_AI_TIMEOUT = 120 * 1000;
const POLISH_PREFETCH_TARGET = 3;
const MAX_SONG_LINES = 24;
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
  profileSyncReady: false,
  cards: [],
  starterPacks: [],
  folders: [],
  currentIndex: 0,
  flipped: false,
  studySettings: { mode: "picture", updatedAt: 0 },
  draft: null,
  aiOnline: false,
  deepSeekOnline: false,
  aiStatusMessage: "Проверяю AI...",
  language: "english",
  englishPractice: "cards",
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
  englishTrainer: { words: [], exercises: [], currentExercise: null, feedback: null },
  englishTrainerHintVisible: false,
  englishTrainerUsedWordsVisible: false,
  polish: { words: [], exercises: [], currentExercise: null, feedback: null },
  polishHintVisible: false,
  polishUsedWordsVisible: false,
  polishPrefetching: false,
};

const els = {
  studyTitle: document.querySelector("#studyTitle"),
  creatorTitle: document.querySelector("#creatorTitle"),
  reviewStatus: document.querySelector("#reviewStatus"),
  flashcard: document.querySelector("#flashcard"),
  studyModeButtons: document.querySelectorAll("[data-study-mode]"),
  cardFront: document.querySelector("#cardFront"),
  cardBack: document.querySelector("#cardBack"),
  cardRussianPrompt: document.querySelector("#cardRussianPrompt"),
  cardAnswerImage: document.querySelector("#cardAnswerImage"),
  cardPattern: document.querySelector("#cardPattern"),
  cardImage: document.querySelector("#cardImage"),
  cardMotion: document.querySelector("#cardMotion"),
  cardMotionIcon: document.querySelector("#cardMotionIcon"),
  cardCreatorDialog: document.querySelector("#cardCreatorDialog"),
  openCreatorButton: document.querySelector("#openCreatorButton"),
  closeCreatorButton: document.querySelector("#closeCreatorButton"),
  englishCardsTab: document.querySelector("#englishCardsTab"),
  englishSentencesTab: document.querySelector("#englishSentencesTab"),
  englishCardsPractice: document.querySelector("#englishCardsPractice"),
  englishSentencesPractice: document.querySelector("#englishSentencesPractice"),
  openStudyFoldersButton: document.querySelector("#openStudyFoldersButton"),
  practiceSelectionDialog: document.querySelector("#practiceSelectionDialog"),
  openTrainerCardSelectionButton: document.querySelector("#openTrainerCardSelectionButton"),
  studyFolderLabel: document.querySelector("#studyFolderLabel"),
  startBasicActionsButton: document.querySelector("#startBasicActionsButton"),
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
  closeDeckButton: document.querySelector("#closeDeckButton"),
  deckDialog: document.querySelector("#deckDialog"),
  deckSummary: document.querySelector("#deckSummary"),
  folderTree: document.querySelector("#folderTree"),
  folderSummary: document.querySelector("#folderSummary"),
  folderNameInput: document.querySelector("#folderNameInput"),
  createFolderButton: document.querySelector("#createFolderButton"),
  openSongButton: document.querySelector("#openSongButton"),
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
  englishTrainerWordsInput: document.querySelector("#englishTrainerWordsInput"),
  addEnglishTrainerWordsButton: document.querySelector("#addEnglishTrainerWordsButton"),
  suggestEnglishTrainerWordsButton: document.querySelector("#suggestEnglishTrainerWordsButton"),
  openEnglishTrainerDictionaryButton: document.querySelector("#openEnglishTrainerDictionaryButton"),
  englishTrainerDictionarySummary: document.querySelector("#englishTrainerDictionarySummary"),
  englishTrainerDictionaryStatus: document.querySelector("#englishTrainerDictionaryStatus"),
  englishTrainerDictionaryPreview: document.querySelector("#englishTrainerDictionaryPreview"),
  englishTrainerDictionaryDialog: document.querySelector("#englishTrainerDictionaryDialog"),
  closeEnglishTrainerDictionaryButton: document.querySelector("#closeEnglishTrainerDictionaryButton"),
  englishTrainerDictionarySearch: document.querySelector("#englishTrainerDictionarySearch"),
  englishTrainerDictionaryFilter: document.querySelector("#englishTrainerDictionaryFilter"),
  englishTrainerDictionaryCount: document.querySelector("#englishTrainerDictionaryCount"),
  englishTrainerDictionaryList: document.querySelector("#englishTrainerDictionaryList"),
  englishTrainerExerciseCount: document.querySelector("#englishTrainerExerciseCount"),
  englishTrainerExerciseMode: document.querySelector("#englishTrainerExerciseMode"),
  englishTrainerFolderChoices: document.querySelector("#englishTrainerFolderChoices"),
  englishTrainerFolderSummary: document.querySelector("#englishTrainerFolderSummary"),
  createEnglishTrainerExerciseButton: document.querySelector("#createEnglishTrainerExerciseButton"),
  openEnglishTrainerTextButton: document.querySelector("#openEnglishTrainerTextButton"),
  englishTrainerTextDialog: document.querySelector("#englishTrainerTextDialog"),
  closeEnglishTrainerTextButton: document.querySelector("#closeEnglishTrainerTextButton"),
  englishTrainerManualPromptInput: document.querySelector("#englishTrainerManualPromptInput"),
  startEnglishTrainerManualPromptButton: document.querySelector("#startEnglishTrainerManualPromptButton"),
  englishTrainerExerciseCard: document.querySelector("#englishTrainerExerciseCard"),
  englishTrainerPromptRu: document.querySelector("#englishTrainerPromptRu"),
  englishTrainerExerciseHint: document.querySelector("#englishTrainerExerciseHint"),
  englishTrainerUsedWords: document.querySelector("#englishTrainerUsedWords"),
  englishTrainerAnswerInput: document.querySelector("#englishTrainerAnswerInput"),
  checkEnglishTrainerAnswerButton: document.querySelector("#checkEnglishTrainerAnswerButton"),
  englishTrainerFeedback: document.querySelector("#englishTrainerFeedback"),
  englishTrainerStatus: document.querySelector("#englishTrainerStatus"),
  polishView: document.querySelector("#polishView"),
  polishAiStatus: document.querySelector("#polishAiStatus"),
  openPolishTextButton: document.querySelector("#openPolishTextButton"),
  polishTextDialog: document.querySelector("#polishTextDialog"),
  closePolishTextButton: document.querySelector("#closePolishTextButton"),
  polishManualPromptInput: document.querySelector("#polishManualPromptInput"),
  startPolishManualPromptButton: document.querySelector("#startPolishManualPromptButton"),
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

const { normalizeActivity, mergeActivity, activitiesHaveSameSyncState } = globalThis.ActionCardsActivity;
const practiceSelection = globalThis.PracticeSelection;
let practiceSelectionTarget = "cards";
const practiceSelector = practiceSelection.create({
  dialog: els.practiceSelectionDialog,
  folders: document.querySelector("#practiceFolderChoices"),
  list: document.querySelector("#practiceCardChoices"),
  search: document.querySelector("#practiceCardSearch"),
  summary: document.querySelector("#practiceSelectionCount"),
  apply: document.querySelector("#applyPracticeSelectionButton"),
  all: document.querySelector("#selectAllPracticeCardsButton"),
  none: document.querySelector("#clearPracticeCardsButton"),
  more: document.querySelector("#morePracticeCardsButton"),
  getCards: () => state.cards,
  getFolders: getFolderTreePaths,
  matches: folderDescendantMatches,
  onApply: applyPracticeSelection,
});
const activityTracker = globalThis.ActionCardsActivity.createActivityTracker({
  getActivity: () => state.activity,
  setActivity: (activity) => { state.activity = activity; },
  persist: persistActivity,
});
const { prepare: prepareActivity, recordStudy: recordStudyActivity, hasChosenGoal: hasChosenActivityGoal, milestoneLabel } = activityTracker;
const swipes = globalThis.ActionCardsSwipe.createSwipeController({
  element: els.flashcard, eventTarget: window,
  hasCard: () => Boolean(currentCard()), onRate: rateCard,
});

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

function normalizeSearchText(value, maxLength = 260) {
  return normalizeFreeText(value, maxLength)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function inferPolishPartOfSpeech(word = "", explicitPart = "") {
  const part = normalizeFreeText(explicitPart, 40).toLowerCase();
  if (part.includes("verb") || part.includes("глаг") || part.includes("czasownik")) return "verb";
  if (part.includes("noun") || part.includes("существ") || part.includes("rzeczownik")) return "noun";
  if (part.includes("phrase") || part.includes("фраз") || part.includes("wyraż")) return "phrase";
  if (part.includes("adj") || part.includes("прилаг") || part.includes("przymiotnik")) return "adjective";
  const cleanWord = normalizePolishWord(word);
  if (cleanWord.includes(" ")) return "phrase";
  const key = polishWordKey(cleanWord);
  if (/ć(?: się)?$/.test(cleanWord) || ["moc"].includes(key)) return "verb";
  if (/a$|ość$|ść$|ek$|ik$|ka$|ko$|nia$|nie$/.test(cleanWord) || /^[a-ząćęłńóśźż]+[bcćdfghjklłmnńprsśtwzźż]$/.test(cleanWord)) return "noun";
  return "";
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

function getLocalEnglishTrainerKey() {
  return `${ENGLISH_TRAINER_KEY}:${state.profileId}`;
}

function normalizeStudySettings(settings = {}) {
  return {
    mode: settings?.mode === "russian" ? "russian" : "picture",
    ...(settings?.selection && typeof settings.selection === "object" ? { selection: practiceSelection.normalize(settings.selection) } : {}),
    updatedAt: Number.isFinite(settings?.updatedAt) ? Math.max(0, settings.updatedAt) : 0,
  };
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
  state.studySettings = normalizeStudySettings();
  try {
    state.studySettings = normalizeStudySettings(JSON.parse(localStorage.getItem(`${STUDY_SETTINGS_KEY}:${state.profileId}`) || "{}"));
    state.starterPacks = normalizeStarterPacks(JSON.parse(localStorage.getItem(`${STARTER_PACKS_KEY}:${state.profileId}`) || "[]"));
    const savedCards = JSON.parse(localStorage.getItem(getLocalCardsKey())) || [];
    state.cards = savedCards.map(hydrateCard);
    const savedFolders = JSON.parse(localStorage.getItem(getLocalFoldersKey())) || [];
    state.folders = Array.isArray(savedFolders) ? savedFolders.map(normalizeFolderPath).filter(Boolean) : [];
    state.activity = normalizeActivity(JSON.parse(localStorage.getItem(getLocalActivityKey()) || "{}"));
    state.englishTrainer = normalizeEnglishTrainerState(JSON.parse(localStorage.getItem(getLocalEnglishTrainerKey()) || "{}"));
    state.polish = normalizePolishState(JSON.parse(localStorage.getItem(getLocalPolishKey()) || "{}"));
  } catch {
    state.cards = [];
    state.folders = [];
    state.activity = normalizeActivity();
    state.englishTrainer = normalizeEnglishTrainerState();
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
    const serverStudySettings = normalizeStudySettings(data.studySettings);
    const localStudySettings = normalizeStudySettings(state.studySettings);
    state.studySettings = localStudySettings.updatedAt > serverStudySettings.updatedAt ? localStudySettings : serverStudySettings;
    state.cards = mergeCards(serverCards, localCards);
    state.starterPacks = normalizeStarterPacks([...state.starterPacks, ...normalizeStarterPacks(data.starterPacks)]);
    if (Array.isArray(data.folders)) {
      mergeFolders(data.folders);
    }
    const localActivity = normalizeActivity(state.activity);
    const serverActivity = normalizeActivity(data.activity);
    state.activity = mergeActivity(serverActivity, localActivity);
    const localEnglishTrainer = normalizeEnglishTrainerState(state.englishTrainer);
    const serverEnglishTrainer = normalizeEnglishTrainerState(data.englishTrainer);
    state.englishTrainer = mergeEnglishTrainerState(serverEnglishTrainer, localEnglishTrainer);
    const localPolish = normalizePolishState(state.polish);
    const serverPolish = normalizePolishState(data.polish);
    state.polish = mergePolishState(serverPolish, localPolish);
    await ensureStarterCards();
    persistCardsLocally();
    state.profileSyncReady = true;
    renderStudy(0);
    renderEnglishTrainer();
    renderPolish();
    syncGoalDialog();
    if (
      !cardsHaveSameSyncState(state.cards, serverCards) ||
      JSON.stringify(state.studySettings) !== JSON.stringify(serverStudySettings) ||
      JSON.stringify(state.starterPacks) !== JSON.stringify(normalizeStarterPacks(data.starterPacks)) ||
      !foldersHaveSameSyncState(data.folders || [], getAllFolders()) ||
      !activitiesHaveSameSyncState(state.activity, serverActivity) ||
      englishTrainerSyncSignature(state.englishTrainer) !== englishTrainerSyncSignature(serverEnglishTrainer) ||
      polishSyncSignature(state.polish) !== polishSyncSignature(serverPolish)
    ) {
      syncCardsToServer();
    }
  }
}

function normalizeStarterPacks(packs) {
  return [...new Set((Array.isArray(packs) ? packs : []).filter((pack) => typeof pack === "string"))].sort();
}

async function ensureStarterCards({ restore = false } = {}) {
  if (!state.cards.length && !state.starterPacks.length && !restore) {
    state.cards = await loadStarterCards();
    return;
  }
  const phrases = new Set(state.cards.map((card) => songPhraseKey(card.phrase)));
  for (const pack of STARTER_PACKS) {
    if (state.starterPacks.includes(pack.id) && !(restore && pack.id === BASIC_ACTIONS_PACK)) continue;
    const cards = await loadStarterCards(pack.id);
    for (const card of cards) {
      const key = songPhraseKey(card.phrase);
      if (phrases.has(key)) continue;
      state.cards.push(card);
      phrases.add(key);
    }
  }
}

async function loadOfflineStarterCards() {
  await ensureStarterCards();
  persistCardsLocally();
  renderStudy();
}

async function startBasicActions() {
  els.startBasicActionsButton.disabled = true;
  try {
    await ensureStarterCards({ restore: true });
    state.activeFolder = BASIC_ACTIONS_FOLDER;
    useStudyFolder(BASIC_ACTIONS_FOLDER);
    localStorage.setItem(FOLDER_KEY, state.activeFolder);
    saveCards();
    renderStudy(0);
  } finally {
    els.startBasicActionsButton.disabled = false;
  }
}

async function loadStarterCards(pack = "") {
  try {
    const response = await fetch(DEFAULT_CARDS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("starter cards unavailable");
    const data = await response.json();
    if (!Array.isArray(data.cards)) throw new Error("Invalid starter cards");
    const selectedPack = STARTER_PACKS.find((item) => item.id === pack);
    if (pack && !selectedPack) throw new Error("Unknown starter pack");
    const sourceCards = data.cards.filter((card) => !pack || card.id.startsWith(selectedPack.prefix));
    const cards = sourceCards.map((card) => ({
      ...hydrateCard(card),
      id: STARTER_PACKS.some((item) => card.id.startsWith(item.prefix))
        ? `${card.id}-${state.profileId}` : `starter-${state.profileId}-${data.cards.indexOf(card) + 1}`,
    }));
    for (const item of STARTER_PACKS) {
      if (sourceCards.some((card) => card.id.startsWith(item.prefix))) {
        state.starterPacks = normalizeStarterPacks([...state.starterPacks, item.id]);
      }
    }
    return cards.map((card, index) => ({
      ...card,
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

function persistCardsLocally() {
  localStorage.setItem(`${STUDY_SETTINGS_KEY}:${state.profileId}`, JSON.stringify(state.studySettings));
  localStorage.setItem(`${STARTER_PACKS_KEY}:${state.profileId}`, JSON.stringify(state.starterPacks));
  localStorage.setItem(getLocalCardsKey(), JSON.stringify(state.cards));
  localStorage.setItem(getLocalFoldersKey(), JSON.stringify(getAllFolders()));
  localStorage.setItem(getLocalActivityKey(), JSON.stringify(state.activity));
  localStorage.setItem(getLocalEnglishTrainerKey(), JSON.stringify(state.englishTrainer));
  localStorage.setItem(getLocalPolishKey(), JSON.stringify(state.polish));
}

function saveCards() {
  persistCardsLocally();
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

function normalizeEnglishTrainerWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[^a-z' -]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function englishTrainerWordKey(word) {
  return normalizeEnglishTrainerWord(word);
}

function inferEnglishTrainerPartOfSpeech(word = "", explicitPart = "") {
  const part = normalizeFreeText(explicitPart, 40).toLowerCase();
  if (part.includes("verb") || part.includes("глаг")) return "verb";
  if (part.includes("noun") || part.includes("существ")) return "noun";
  if (part.includes("phrase") || part.includes("фраз")) return "phrase";
  if (part.includes("adj") || part.includes("прилаг")) return "adjective";
  const cleanWord = normalizeEnglishTrainerWord(word);
  if (cleanWord.includes(" ")) return "phrase";
  if (cleanWord.endsWith("ing") || cleanWord.endsWith("ed")) return "verb";
  return "";
}

function normalizeEnglishTrainerWordEntry(entry = {}) {
  const word = normalizeEnglishTrainerWord(entry.word || entry.english || "");
  if (!word) return null;
  return {
    id: entry.id || crypto.randomUUID(),
    word,
    translation: normalizeFreeText(entry.translation || entry.ru || "", 80),
    partOfSpeech: inferEnglishTrainerPartOfSpeech(word, entry.partOfSpeech || entry.pos || ""),
    level: normalizeFreeText(entry.level || "A1", 20),
    notes: normalizeFreeText(entry.notes || "", 160),
    boostRemaining: Math.max(0, Math.min(12, Number(entry.boostRemaining || entry.priorityBoost || 0) || 0)),
    createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
  };
}

function normalizeTrainerFolderPaths(value) {
  const paths = [...new Set((Array.isArray(value) ? value : [value || "all"])
    .filter((path) => typeof path === "string")
    .map(normalizeFolderPath).filter(Boolean))].sort((left, right) => left.localeCompare(right, "ru"));
  return paths.length && !paths.includes("all") ? paths : ["all"];
}

function normalizeEnglishTrainerExercise(exercise = {}) {
  if (!exercise.promptRu) return null;
  return {
    id: exercise.id || crypto.randomUUID(),
    promptRu: normalizeFreeText(exercise.promptRu, 620),
    expectedEn: normalizeFreeText(exercise.expectedEn || exercise.expectedEnglish, 620),
    hint: normalizeFreeText(exercise.hint, 420),
    mode: ["easy", "medium", "hard", "manual"].includes(exercise.mode) ? exercise.mode : "medium",
    exerciseStyle: normalizeFreeText(exercise.exerciseStyle || "", 20),
    folderPath: normalizeFolderPath(exercise.folderPath || "all"),
    folderPaths: normalizeTrainerFolderPaths(exercise.folderPaths ?? exercise.folderPath),
    targetCount: [5, 10, 20].includes(Number(exercise.targetCount || exercise.count)) ? Number(exercise.targetCount || exercise.count) : 10,
    usedWords: Array.isArray(exercise.usedWords) ? exercise.usedWords.map(normalizeEnglishTrainerWord).filter(Boolean).slice(0, 16) : [],
    grammarFocus: Array.isArray(exercise.grammarFocus) ? exercise.grammarFocus.map((item) => normalizeFreeText(item, 100)).filter(Boolean).slice(0, 8) : [],
    createdAt: Number.isFinite(exercise.createdAt) ? exercise.createdAt : Date.now(),
  };
}

function normalizeEnglishTrainerState(englishTrainer = {}) {
  const wordsByKey = new Map();
  if (Array.isArray(englishTrainer.words)) {
    englishTrainer.words.forEach((entry) => {
      const normalized = normalizeEnglishTrainerWordEntry(entry);
      if (!normalized) return;
      const key = englishTrainerWordKey(normalized.word);
      wordsByKey.set(key, { ...(wordsByKey.get(key) || {}), ...normalized });
    });
  }

  const exercises = Array.isArray(englishTrainer.exercises)
    ? englishTrainer.exercises.map(normalizeEnglishTrainerExercise).filter(Boolean).slice(0, 30)
    : [];
  const currentExercise = normalizeEnglishTrainerExercise(englishTrainer.currentExercise || {}) || null;
  const folderPaths = normalizeTrainerFolderPaths(englishTrainer.folderPaths ?? englishTrainer.folderPath);

  return {
    words: [...wordsByKey.values()].sort((left, right) => left.word.localeCompare(right.word, "en")),
    folderPath: folderPaths[0],
    folderPaths,
    cardIds: practiceSelection.normalize(englishTrainer).cardIds,
    folderUpdatedAt: Number.isFinite(englishTrainer.folderUpdatedAt) ? englishTrainer.folderUpdatedAt : 0,
    excludedCardWords: [...new Set((Array.isArray(englishTrainer.excludedCardWords) ? englishTrainer.excludedCardWords : [])
      .map(englishTrainerWordKey).filter(Boolean))].sort(),
    exercises,
    currentExercise,
    feedback: englishTrainer.feedback && typeof englishTrainer.feedback === "object" ? englishTrainer.feedback : null,
  };
}

function englishTrainerSyncSignature(englishTrainer = {}) {
  const normalized = normalizeEnglishTrainerState(englishTrainer);
  return JSON.stringify({
    folderPath: normalized.folderPath,
    folderPaths: normalized.folderPaths,
    cardIds: normalized.cardIds,
    folderUpdatedAt: normalized.folderUpdatedAt,
    excludedCardWords: normalized.excludedCardWords,
    words: normalized.words.map((word) => ({
      word: word.word,
      translation: word.translation,
      partOfSpeech: word.partOfSpeech,
      level: word.level,
      notes: word.notes,
      boostRemaining: word.boostRemaining,
    })),
    currentExercise: normalized.currentExercise,
    exercises: normalized.exercises,
  });
}

function mergeEnglishTrainerState(serverEnglishTrainer = {}, localEnglishTrainer = {}) {
  const mergedWords = [
    ...normalizeEnglishTrainerState(serverEnglishTrainer).words,
    ...normalizeEnglishTrainerState(localEnglishTrainer).words,
  ];
  const exercisesById = new Map();
  [
    ...normalizeEnglishTrainerState(serverEnglishTrainer).exercises,
    ...normalizeEnglishTrainerState(localEnglishTrainer).exercises,
  ].forEach((exercise) => {
    exercisesById.set(exercise.id, exercise);
  });
  return normalizeEnglishTrainerState({
    words: mergedWords,
    folderPaths: normalizeEnglishTrainerState(localEnglishTrainer.folderUpdatedAt > (serverEnglishTrainer.folderUpdatedAt || 0)
      ? localEnglishTrainer : serverEnglishTrainer).folderPaths,
    cardIds: normalizeEnglishTrainerState(localEnglishTrainer.folderUpdatedAt > (serverEnglishTrainer.folderUpdatedAt || 0)
      ? localEnglishTrainer : serverEnglishTrainer).cardIds,
    folderUpdatedAt: Math.max(localEnglishTrainer.folderUpdatedAt || 0, serverEnglishTrainer.folderUpdatedAt || 0),
    excludedCardWords: [
      ...normalizeEnglishTrainerState(serverEnglishTrainer).excludedCardWords,
      ...normalizeEnglishTrainerState(localEnglishTrainer).excludedCardWords,
    ],
    exercises: [...exercisesById.values()].sort((left, right) => right.createdAt - left.createdAt),
    currentExercise: normalizeEnglishTrainerState(localEnglishTrainer).currentExercise || normalizeEnglishTrainerState(serverEnglishTrainer).currentExercise,
    feedback: normalizeEnglishTrainerState(localEnglishTrainer).feedback || normalizeEnglishTrainerState(serverEnglishTrainer).feedback,
  });
}

function normalizePolishWordEntry(entry = {}) {
  const word = normalizePolishWord(entry.word || entry.polish || "");
  if (!word) return null;
  const partOfSpeech = inferPolishPartOfSpeech(word, entry.partOfSpeech || entry.pos || "");
  return {
    id: entry.id || crypto.randomUUID(),
    word,
    translation: normalizeFreeText(entry.translation || entry.ru || "", 80),
    partOfSpeech,
    gender: normalizeFreeText(entry.gender || "", 30),
    level: normalizeFreeText(entry.level || "A1", 20),
    notes: normalizeFreeText(entry.notes || "", 160),
    forms: entry.forms && typeof entry.forms === "object" ? entry.forms : {},
    boostRemaining: Math.max(0, Math.min(12, Number(entry.boostRemaining || entry.priorityBoost || 0) || 0)),
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
  if (!state.profileSyncReady) return;
  try {
    await fetch("/api/cards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: state.profileId,
        cards: state.cards,
        starterPacks: state.starterPacks,
        studySettings: state.studySettings,
        folders: getAllFolders(),
        activity: state.activity,
        englishTrainer: state.englishTrainer,
        polish: state.polish,
      }),
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
    patternTranslation: card.patternTranslation || "",
    textOnly: card.textOnly === true,
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
    savedCard.patternTranslation,
    savedCard.textOnly,
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
  return state.studySettings.selection
    ? practiceSelection.filter(state.cards, state.studySettings.selection, folderDescendantMatches)
    : getFolderDeck();
}

function getFolderDeck() {
  return state.cards.filter(folderMatches);
}

function useStudyFolder(folder) {
  state.studySettings = { ...state.studySettings, selection: { folderPaths: [folder], cardIds: null }, updatedAt: Math.max(Date.now(), state.studySettings.updatedAt + 1) };
}

function openPracticeSelection(target = "cards") {
  practiceSelectionTarget = target;
  const selection = target === "sentences" ? state.englishTrainer
    : state.studySettings.selection || { folderPaths: [state.activeFolder] };
  practiceSelector.open(selection);
}

function applyPracticeSelection(selection) {
  if (practiceSelectionTarget === "sentences") {
    setEnglishTrainerFolders(selection.folderPaths, selection.cardIds);
    renderEnglishTrainer();
    setEnglishTrainerStatus("Выбор карточек сохранён.", "ok");
  } else {
    state.studySettings = { ...state.studySettings, selection, updatedAt: Math.max(Date.now(), state.studySettings.updatedAt + 1) };
    renderStudy(0);
  }
  saveCards();
  closeAppDialog(els.practiceSelectionDialog);
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

function persistActivity() {
  localStorage.setItem(getLocalActivityKey(), JSON.stringify(state.activity));
  syncCardsToServer();
}

function setFlameLevel(element, level) {
  if (!element) return;
  element.classList.remove("flame-level-0", "flame-level-1", "flame-level-2", "flame-level-3", "flame-level-4", "flame-level-5");
  element.classList.add(`flame-level-${level}`);
}

function renderActivity() {
  if (!els.activitySummary || !els.activityButton) return;
  const { todayCount, goal, todayDone, progress, streak, nextMilestone, daysToGoal, flameLevel: currentFlameLevel, goalLabel } = activityTracker.summary();

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
  els.activityProgressText.textContent = todayDone ? "Огонек зажжен сегодня" : `${goalLabel} уровень · осталось ${goal - Math.min(todayCount, goal)}`;
  els.activityStreakText.textContent = `Серия: ${streak} дн.`;
  els.activityGoalText.textContent = daysToGoal ? `Цель ${milestoneLabel(nextMilestone)}: еще ${daysToGoal} дн.` : `Цель ${milestoneLabel(nextMilestone)} выполнена`;
  els.activityFreezeText.textContent = `Заморозки: ${state.activity.freezes}`;
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
  if (!activityTracker.chooseGoal(mode)) return;
  closeGoalDialog();
  renderActivity();
}

function renderStudy(index = state.currentIndex) {
  swipes.cancel();
  if (state.activeFolder !== "all" && !getFolderTreePaths().includes(state.activeFolder)) state.activeFolder = "all";
  const deck = getStudyDeck();
  const selection = state.studySettings.selection;
  els.studyFolderLabel.textContent = selection
    ? `${selection.folderPaths.map(folderLabel).join(", ") || "Нет папок"}${selection.cardIds === null ? "" : ` · Карточек: ${deck.length}`}`
    : folderLabel(state.activeFolder);

  if (!deck.length) {
    state.currentIndex = 0;
    state.flipped = false;
    els.studyTitle.textContent = state.cards.length ? "В этой папке пока пусто" : "Пока нет карточек";
    els.reviewStatus.textContent = state.cards.length ? folderLabel(state.activeFolder) : "0 карточек";
    els.flashcard.classList.remove("is-flipped");
    els.flashcard.style.transform = "";
    setVisual(els.cardImage, "", "Картинка появится здесь");
    els.cardMotion.hidden = true;
    els.cardPhrase.textContent = "No cards yet";
    setTranslation("", true);
    renderStudyMode();
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
  const motionIcon = BASIC_ACTION_MOTIONS.get(songPhraseKey(card.phrase));
  els.cardMotion.hidden = !motionIcon;
  if (motionIcon) els.cardMotionIcon.setAttribute("href", `assets/icons.svg#${motionIcon}`);
  els.cardPhrase.textContent = card.phrase;
  setTranslation(card.translation, true);
  renderStudyMode();
  updateSpeechControls();
  renderActivity();
  renderDeck();
}

function setStudyMode(mode) {
  if (!["picture", "russian"].includes(mode) || mode === state.studySettings.mode) return;
  state.studySettings = { ...state.studySettings, mode, updatedAt: Math.max(Date.now(), state.studySettings.updatedAt + 1) };
  renderStudy();
  saveCards();
}

function renderStudyMode() {
  const card = currentCard();
  const russian = state.studySettings.mode === "russian" || Boolean(card?.textOnly);
  els.studyModeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.studyMode === (russian ? "russian" : "picture")));
    button.disabled = Boolean(card?.textOnly) && button.dataset.studyMode === "picture";
  });
  els.flashcard.classList.toggle("is-russian-mode", russian);
  els.flashcard.classList.toggle("is-text-only", Boolean(card?.textOnly));
  els.cardImage.hidden = russian;
  els.cardRussianPrompt.hidden = !russian;
  els.cardRussianPrompt.textContent = card
    ? String(card.translation || "").trim() || "У этой карточки пока нет русского перевода."
    : "Добавь карточку для тренировки.";
  els.cardPattern.hidden = !card?.patternTranslation;
  els.cardPattern.textContent = card?.patternTranslation ? `${card.word} — ${card.patternTranslation}` : "";
  els.cardAnswerImage.hidden = !russian || card?.textOnly || !card?.imageUrl;
  setVisual(els.cardAnswerImage, russian ? card?.imageUrl : "");
  els.cardTranslation.hidden = russian;
  if (russian) els.cardMotion.hidden = true;
  updateCardFaceAccessibility();
}

function updateCardFaceAccessibility() {
  els.cardFront.setAttribute("aria-hidden", String(state.flipped));
  els.cardBack.setAttribute("aria-hidden", String(!state.flipped));
  els.cardFront.toggleAttribute("inert", state.flipped);
  els.cardBack.toggleAttribute("inert", !state.flipped);
  els.flashcard.setAttribute("aria-label", state.flipped
    ? (state.studySettings.mode === "russian" || currentCard()?.textOnly ? "Показать русский текст" : "Показать картинку")
    : "Показать фразу на английском");
}

function renderDeck() {
  els.deckList.replaceChildren();
  renderFolderTree();
  renderBulkFolderOptions();
  updateBulkToolbar();

  const deck = getFolderDeck();
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
    item.classList.toggle("is-text-only", card.textOnly);
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
      useStudyFolder(state.activeFolder);
      saveCards();
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
  getFolderDeck().forEach((card) => state.selectedCardIds.add(card.id));
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
  els.selectVisibleCardsButton.disabled = getFolderDeck().length === 0;
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
  useStudyFolder(targetFolder);
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
  els.folderSummary.textContent = `${folderLabel(state.activeFolder)} · ${getFolderDeck().length}`;
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
    useStudyFolder(folder);
    localStorage.setItem(FOLDER_KEY, state.activeFolder);
    saveCards();
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
  if (!swipes.canFlip()) return;
  if (!currentCard()) return;
  state.flipped = !state.flipped;
  els.flashcard.classList.toggle("is-flipped", state.flipped);
  updateCardFaceAccessibility();
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
  const visibleCards = getStudyDeck();

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
  els.creatorTitle.textContent = state.editingCardId ? "Изменить карточку" : "Новая карточка";
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
  closeAppDialog(els.cardCreatorDialog);
  setEnglishPractice("cards");
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

function setEnglishTrainerStatus(message, tone = "neutral") {
  if (!els.englishTrainerStatus) return;
  els.englishTrainerStatus.textContent = message;
  els.englishTrainerStatus.dataset.tone = tone;
  els.englishTrainerDictionaryStatus.textContent = message;
  els.englishTrainerDictionaryStatus.dataset.tone = tone;
}

function parseEnglishTrainerWordLines(text) {
  return String(text || "")
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+[-–—:]\s+|\s*=\s*/);
      const word = normalizeEnglishTrainerWord(parts[0] || line);
      return normalizeEnglishTrainerWordEntry({
        word,
        translation: normalizeFreeText(parts.slice(1).join(" - "), 80),
        partOfSpeech: inferEnglishTrainerPartOfSpeech(word),
        level: "A1",
        notes: word.includes(" ") ? "устойчивое выражение" : "",
      });
    })
    .filter(Boolean);
}

function shouldExtractEnglishTrainerWordsWithAi(text = "") {
  const cleanText = String(text || "").trim();
  if (!cleanText) return false;
  const lines = cleanText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return /[.!?]/.test(cleanText) || lines.some((line) => line.split(/\s+/).length >= 4 && !/\s[-–—:]\s/.test(line));
}

function englishTrainerWordsNeedAiDetails(words = []) {
  return words.some((word) => !word.translation || !word.partOfSpeech);
}

function mergeEnglishTrainerWords(words = []) {
  state.englishTrainer = normalizeEnglishTrainerState(state.englishTrainer);
  const byKey = new Map(state.englishTrainer.words.map((word) => [englishTrainerWordKey(word.word), word]));
  words.forEach((entry) => {
    const normalized = normalizeEnglishTrainerWordEntry(entry);
    if (!normalized) return;
    const key = englishTrainerWordKey(normalized.word);
    byKey.set(key, { ...(byKey.get(key) || {}), ...normalized });
    state.englishTrainer.excludedCardWords = state.englishTrainer.excludedCardWords.filter((excluded) => excluded !== key);
  });
  state.englishTrainer.words = [...byKey.values()].sort((left, right) => left.word.localeCompare(right.word, "en"));
  return words.map(normalizeEnglishTrainerWordEntry).filter(Boolean).length;
}

function englishTrainerWords(selection = "all", cardIds = null) {
  const folderPaths = normalizeTrainerFolderPaths(selection);
  const allFolders = folderPaths.includes("all") && cardIds === null;
  const trainer = normalizeEnglishTrainerState(state.englishTrainer);
  const cards = practiceSelection.filter(state.cards, { folderPaths, cardIds }, folderDescendantMatches);
  const cardKeys = new Set(cards.map((card) => englishTrainerWordKey(card.word)));
  const byKey = new Map(trainer.words.filter((word) => allFolders || cardKeys.has(englishTrainerWordKey(word.word)))
    .map((word) => [englishTrainerWordKey(word.word), word]));
  const excluded = new Set(trainer.excludedCardWords);
  // Card keywords are vocabulary; the sentence translation is context, not a word translation.
  for (const card of cards) {
    const key = englishTrainerWordKey(card.word);
    if (!key || excluded.has(key)) continue;
    const existing = byKey.get(key);
    byKey.set(key, {
      ...normalizeEnglishTrainerWordEntry({
        id: `card-word:${key}`,
        word: key,
        translation: card.patternTranslation || "",
        notes: [card.phrase, card.translation].filter(Boolean).join(" — "),
        createdAt: card.createdAt,
      }),
      ...existing,
      notes: (allFolders && existing?.notes) || normalizeFreeText([card.phrase, card.translation].filter(Boolean).join(" — "), 160),
      fromCards: true,
      contextTranslation: existing?.contextTranslation || card.translation,
    });
  }
  return [...byKey.values()].sort((left, right) => left.word.localeCompare(right.word, "en"));
}

async function addEnglishTrainerWordsFromInput() {
  const text = els.englishTrainerWordsInput.value;
  let words = parseEnglishTrainerWordLines(text);
  if (!words.length) {
    setEnglishTrainerStatus("Напиши хотя бы одно английское слово.", "warn");
    els.englishTrainerWordsInput.focus();
    return;
  }

  els.addEnglishTrainerWordsButton.disabled = true;
  try {
    if (shouldExtractEnglishTrainerWordsWithAi(text) || englishTrainerWordsNeedAiDetails(words)) {
      setEnglishTrainerStatus("AI разбирает текст на полезные английские слова и фразы.", "work");
      await updateAiStatus();
      if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
      const data = await requestPolishApi("/api/english/sentence-trainer/extract-words", {
        text,
        existingWords: englishTrainerWords().map((word) => word.word),
      });
      words = Array.isArray(data.words) ? data.words : [];
    }

    if (!words.length) {
      setEnglishTrainerStatus("AI не нашел новых слов в этом тексте.", "warn");
      return;
    }

    mergeEnglishTrainerWords(words);
    els.englishTrainerWordsInput.value = "";
    saveCards();
    renderEnglishTrainer();
    setEnglishTrainerStatus(`Добавлено слов/фраз: ${words.length}.`, "ok");
  } catch (error) {
    setEnglishTrainerStatus(`Не получилось разобрать слова: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.addEnglishTrainerWordsButton.disabled = false;
  }
}

async function suggestEnglishTrainerWords() {
  state.englishTrainer = normalizeEnglishTrainerState(state.englishTrainer);
  els.suggestEnglishTrainerWordsButton.disabled = true;
  setEnglishTrainerStatus("AI подбирает базовые английские слова.", "work");
  try {
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const data = await requestPolishApi("/api/english/sentence-trainer/suggest-words", {
      existingWords: englishTrainerWords().map((word) => word.word),
      count: 10,
    });
    const words = Array.isArray(data.words) ? data.words : [];
    if (!words.length) {
      setEnglishTrainerStatus("AI не нашел новых слов. Попробуй позже.", "warn");
      return;
    }
    els.englishTrainerWordsInput.value = words
      .map((word) => [word.word || word.english, word.translation || word.ru].filter(Boolean).join(" - "))
      .filter(Boolean)
      .join("\n");
    els.englishTrainerWordsInput.focus();
    setEnglishTrainerStatus("AI вписал слова в поле. Нажми «Добавить мои слова».", "ok");
  } catch (error) {
    setEnglishTrainerStatus(`Не получилось предложить слова: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.suggestEnglishTrainerWordsButton.disabled = false;
  }
}

function englishTrainerWordType(word = {}) {
  const part = inferEnglishTrainerPartOfSpeech(word.word, word.partOfSpeech);
  return part || "other";
}

function englishTrainerWordTypeLabel(type) {
  return {
    verb: "Глагол",
    noun: "Существительное",
    phrase: "Фраза",
    adjective: "Прилагательное",
    other: "Слово",
  }[type] || "Слово";
}

function filteredEnglishTrainerWords() {
  const queryTokens = normalizeSearchText(els.englishTrainerDictionarySearch?.value || "", 120)
    .split(/[,\s]+/)
    .filter(Boolean);
  const filter = els.englishTrainerDictionaryFilter?.value || "all";
  return englishTrainerWords().filter((word) => {
    const type = englishTrainerWordType(word);
    const haystack = normalizeSearchText([word.word, word.translation, word.contextTranslation, englishTrainerWordTypeLabel(type), word.notes].join(" "), 500);
    return (filter === "all" || type === filter) && (!queryTokens.length || queryTokens.every((token) => haystack.includes(token)));
  });
}

function renderEnglishTrainerDictionary() {
  if (!els.englishTrainerDictionaryList) return;
  const words = filteredEnglishTrainerWords();
  const total = englishTrainerWords().length;
  els.englishTrainerDictionaryCount.textContent = `${words.length} из ${total} слов/фраз`;
  els.englishTrainerDictionaryList.replaceChildren();
  if (!words.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = total ? "По этому поиску ничего не найдено." : "Словарь пустой.";
    els.englishTrainerDictionaryList.append(empty);
    return;
  }

  words.forEach((word) => {
    const row = document.createElement("article");
    row.className = "polish-dictionary-row";
    const type = englishTrainerWordType(word);
    const boostRemaining = Math.max(0, Number(word.boostRemaining) || 0);
    row.classList.toggle("is-boosted", boostRemaining > 0);
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(word.word)}</h3>
        <p>${escapeHtml([word.translation || (word.contextTranslation ? `В карточке: ${word.contextTranslation}` : "перевод не добавлен"), englishTrainerWordTypeLabel(type), boostRemaining ? `чаще: ${boostRemaining}` : ""].filter(Boolean).join(" · "))}</p>
      </div>
    `;
    const boostButton = document.createElement("button");
    boostButton.type = "button";
    boostButton.className = "priority-word-button";
    boostButton.setAttribute("aria-label", boostRemaining ? `Убрать частое повторение слова ${word.word}` : `Повторять чаще слово ${word.word}`);
    boostButton.textContent = boostRemaining ? "★" : "☆";
    boostButton.addEventListener("click", () => boostEnglishTrainerWord(word.id));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-card-button";
    deleteButton.setAttribute("aria-label", `Удалить слово ${word.word}`);
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => removeEnglishTrainerWord(word.id));
    row.append(boostButton, deleteButton);
    els.englishTrainerDictionaryList.append(row);
  });
}

function renderEnglishTrainer() {
  if (!els.englishTrainerDictionarySummary) return;
  state.englishTrainer = normalizeEnglishTrainerState(state.englishTrainer);
  renderEnglishTrainerFolders();
  const words = englishTrainerWords();
  const wordCount = words.length;
  els.englishTrainerDictionarySummary.textContent = `${wordCount} слов/фраз`;
  els.englishTrainerDictionaryPreview.textContent = wordCount
    ? words.slice(0, 6).map((word) => word.word).join(", ")
    : "Пока пусто";
  renderEnglishTrainerDictionary();
  renderEnglishTrainerExercise();
  renderEnglishTrainerFeedback();
}

function removeEnglishTrainerWord(wordId) {
  const word = englishTrainerWords().find((entry) => entry.id === wordId);
  if (!word) return;
  state.englishTrainer = normalizeEnglishTrainerState(state.englishTrainer);
  if (word.fromCards) state.englishTrainer.excludedCardWords.push(englishTrainerWordKey(word.word));
  state.englishTrainer.words = normalizeEnglishTrainerState(state.englishTrainer).words.filter((word) => word.id !== wordId);
  saveCards();
  renderEnglishTrainer();
  setEnglishTrainerStatus("Слово удалено из английской базы.", "ok");
}

function boostEnglishTrainerWord(wordId) {
  const word = englishTrainerWords().find((entry) => entry.id === wordId);
  if (!word) return;
  const boostRemaining = word.boostRemaining > 0 ? 0 : 8;
  mergeEnglishTrainerWords([{ ...word, boostRemaining }]);
  saveCards();
  renderEnglishTrainer();
  setEnglishTrainerStatus(boostRemaining ? `${word.word} будет чаще попадаться в заданиях.` : `${word.word} снова в обычном режиме.`, "ok");
}

function openEnglishTrainerDictionary() {
  renderEnglishTrainer();
  openAppDialog(els.englishTrainerDictionaryDialog);
  window.setTimeout(() => els.englishTrainerDictionarySearch?.focus(), 80);
}

function closeEnglishTrainerDictionary() {
  closeAppDialog(els.englishTrainerDictionaryDialog);
}

function openEnglishTrainerTextDialog() {
  openAppDialog(els.englishTrainerTextDialog);
  window.setTimeout(() => els.englishTrainerManualPromptInput?.focus(), 80);
}

function closeEnglishTrainerTextDialog() {
  closeAppDialog(els.englishTrainerTextDialog);
}

function englishTrainerExerciseSettings() {
  return {
    count: Number(els.englishTrainerExerciseCount.value) || 10,
    mode: els.englishTrainerExerciseMode.value || "medium",
    folderPath: state.englishTrainer.folderPath || "all",
    folderPaths: state.englishTrainer.folderPaths,
  };
}

function renderEnglishTrainerFolders() {
  const folders = getFolderTreePaths();
  const selected = normalizeTrainerFolderPaths(state.englishTrainer.folderPaths ?? state.englishTrainer.folderPath);
  const valid = selected.filter((folder) => folder === "all" || folders.includes(folder));
  if (valid.length !== selected.length) {
    setEnglishTrainerFolders(valid);
  }
  const selection = state.englishTrainer.folderPaths;
  const selectedCards = state.englishTrainer.cardIds;
  els.openTrainerCardSelectionButton.textContent = selectedCards === null ? "Выбрать карточки" : `Выбрано карточек: ${practiceSelection.filter(state.cards, { folderPaths: selection, cardIds: selectedCards }, folderDescendantMatches).length}`;
  els.englishTrainerFolderSummary.textContent = selection.includes("all") ? "Все карточки и слова"
    : `Папки для предложений (${selection.length}): ${selection.map((folder) => folder.split(" / ").at(-1)).join(", ")}`;
  els.englishTrainerFolderChoices.replaceChildren();
  // Sort by path segments so each subtree stays together even with punctuation in names.
  const ordered = folders.sort((left, right) => {
    const a = left.split(" / ");
    const b = right.split(" / ");
    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      const order = a[index].localeCompare(b[index], "ru");
      if (order) return order;
    }
    return a.length - b.length;
  });
  for (const folder of ["all", ...ordered]) {
    const label = document.createElement("label");
    label.style.setProperty("--folder-depth", Math.max(0, folderDepth(folder) - 1));
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = folder;
    checkbox.checked = selection.includes(folder);
    checkbox.setAttribute("aria-label", folder === "all" ? "Все карточки и слова" : folder);
    const name = document.createElement("span");
    name.textContent = folder === "all" ? "Все карточки и слова" : folder.split(" / ").at(-1);
    label.append(checkbox, name);
    els.englishTrainerFolderChoices.append(label);
  }
}

function setEnglishTrainerFolders(folderPaths, cardIds = state.englishTrainer.cardIds ?? null) {
  state.englishTrainer.folderPaths = normalizeTrainerFolderPaths(folderPaths);
  // Keep the single-folder field for older saved profiles and clients.
  state.englishTrainer.folderPath = state.englishTrainer.folderPaths[0];
  state.englishTrainer.cardIds = practiceSelection.normalize({ cardIds }).cardIds;
  state.englishTrainer.folderUpdatedAt = Math.max(Date.now(), (state.englishTrainer.folderUpdatedAt || 0) + 1);
  state.englishTrainer.currentExercise = null;
  state.englishTrainer.feedback = null;
}

function changeEnglishTrainerFolder(event) {
  const checkbox = event.target;
  if (checkbox.type !== "checkbox" || els.englishTrainerFolderChoices.disabled) return;
  const folder = checkbox.value;
  const selected = state.englishTrainer.folderPaths.filter((path) => path !== "all" && path !== folder);
  if (checkbox.checked) selected.push(folder);
  setEnglishTrainerFolders(folder === "all" ? ["all"] : selected, null);
  saveCards();
  renderEnglishTrainer();
  [...els.englishTrainerFolderChoices.querySelectorAll("input")].find((input) => input.value === folder)?.focus();
  setEnglishTrainerStatus("Выбор папок сохранён.", "neutral");
}

function englishTrainerVocabularyForExercise(folderPaths = state.englishTrainer.folderPaths) {
  const words = englishTrainerWords(folderPaths, state.englishTrainer.cardIds ?? null);
  const usage = new Map();
  const recent = state.englishTrainer.exercises.slice(0, 20);
  recent.forEach((exercise, index) => {
    new Set(exercise.usedWords.map(englishTrainerWordKey)).forEach((key) => {
      usage.set(key, (usage.get(key) || 0) + recent.length - index);
    });
  });
  // Shuffle ties, then prefer less-practised vocabulary without losing boosted words.
  for (let index = words.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [words[index], words[target]] = [words[target], words[index]];
  }
  const score = (word) => (usage.get(englishTrainerWordKey(word.word)) || 0) / (word.boostRemaining > 0 ? 3 : 1);
  return words.sort((left, right) => score(left) - score(right)).slice(0, 200);
}

function recentEnglishTrainerExercisesForAi() {
  return state.englishTrainer.exercises
    .slice(0, 30)
    .map((exercise) => ({
      promptRu: exercise.promptRu,
      expectedEn: exercise.expectedEn,
      usedWords: exercise.usedWords,
    }));
}

function englishTrainerSourceCards(folderPaths, words) {
  const rank = new Map(words.map((word, index) => [englishTrainerWordKey(word.word), index]));
  const cards = practiceSelection.filter(state.cards, { folderPaths, cardIds: state.englishTrainer.cardIds }, folderDescendantMatches)
    .filter((card) => rank.has(englishTrainerWordKey(card.word)))
    .sort((left, right) => rank.get(englishTrainerWordKey(left.word)) - rank.get(englishTrainerWordKey(right.word)));
  const groups = folderPaths.map((folder) => cards.filter((card) => folderDescendantMatches(card, folder)));
  const selected = new Set();
  // Interleave folders so a large first folder cannot crowd out the others in the AI request.
  while (selected.size < 40) {
    let added = false;
    for (const group of groups) {
      while (group.length && selected.has(group[0])) group.shift();
      if (group.length && selected.size < 40) {
        selected.add(group.shift());
        added = true;
      }
    }
    if (!added) break;
  }
  return [...selected];
}

async function fetchEnglishTrainerExercise(count, mode) {
  const folderPath = state.englishTrainer.folderPath || "all";
  const folderPaths = [...state.englishTrainer.folderPaths];
  const scoped = !folderPaths.includes("all") || state.englishTrainer.cardIds !== null;
  const words = englishTrainerVocabularyForExercise(folderPaths);
  const focusCount = scoped && count >= 10 ? Math.min(3, Math.max(2, Math.floor(count / 5))) : Math.min(3, Math.max(1, Math.floor(count / 5)));
  const cards = scoped ? englishTrainerSourceCards(folderPaths, words) : [];
  const folderFocus = scoped ? folderPaths.map((folder) => cards.find((card) => folderDescendantMatches(card, folder)))
    .filter(Boolean).map((card) => englishTrainerWordKey(card.word)) : [];
  const focusWords = [...new Set([...folderFocus, ...words.map((word) => word.word)])].slice(0, focusCount);
  const sourceCards = cards.map((card) => ({ word: card.word, phrase: card.phrase, translation: card.translation }));
  const recentExercises = recentEnglishTrainerExercisesForAi();
  const styles = scoped ? ["request", "plan", "short story", "statement"] : ["statement", "request", "plan", "comparison", "short story", "question"];
  const previousStyle = styles.indexOf(state.englishTrainer.currentExercise?.exerciseStyle);
  const exerciseStyle = styles[previousStyle >= 0 ? (previousStyle + 1) % styles.length : state.englishTrainer.exercises.length % styles.length];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const data = await requestPolishApi("/api/english/sentence-trainer/create-exercise", {
      words, focusWords, count, mode, exerciseStyle, recentExercises, folderPath, folderPaths, sourceCards,
    });
    const exercise = normalizeEnglishTrainerExercise({ ...data.exercise, mode, targetCount: count, exerciseStyle, folderPath, folderPaths });
    if (!exercise?.expectedEn) throw new Error("AI не вернул полный текст задания");
    const repeats = recentExercises.some((previous) =>
      englishExerciseTextsMatch(previous.promptRu, exercise.promptRu) ||
      englishExerciseTextsMatch(previous.expectedEn, exercise.expectedEn));
    const enoughFocusWords = !scoped || count < 10 || focusWords.filter((word) => exercise.usedWords.includes(word)).length >= Math.min(2, focusWords.length);
    if (!repeats && exercise.usedWords.includes(focusWords[0]) && enoughFocusWords) return exercise;
    recentExercises.unshift(exercise);
    setEnglishTrainerStatus("Подбираю другое задание по вашим карточкам.", "work");
  }
  throw new Error("AI повторил задание или не использовал выбранное слово. Попробуйте ещё раз");
}

function englishExerciseTextsMatch(left = "", right = "") {
  const key = (text) => String(text).toLowerCase().replace(/ё/g, "е").replace(/[’`´]/g, "'")
    .replace(/[^a-zа-я0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const leftKey = key(left);
  const rightKey = key(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  const leftTokens = new Set(leftKey.split(" "));
  const rightTokens = new Set(rightKey.split(" "));
  if (Math.min(leftTokens.size, rightTokens.size) < 4) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / new Set([...leftTokens, ...rightTokens]).size >= 0.85;
}

function activateEnglishTrainerExercise(exercise, { revealHints = false } = {}) {
  const normalized = normalizeEnglishTrainerExercise(exercise);
  if (!normalized) throw new Error("AI returned no exercise");
  state.englishTrainer.currentExercise = normalized;
  state.englishTrainerHintVisible = revealHints;
  state.englishTrainerUsedWordsVisible = revealHints;
  state.englishTrainer.feedback = null;
  const usedKeys = new Set(normalized.usedWords.map(englishTrainerWordKey));
  state.englishTrainer.words = normalizeEnglishTrainerState(state.englishTrainer).words.map((word) => {
    if (!usedKeys.has(englishTrainerWordKey(word.word)) || !(Number(word.boostRemaining) > 0)) return word;
    return { ...word, boostRemaining: Math.max(0, Number(word.boostRemaining) - 1) };
  });
  state.englishTrainer.exercises = [normalized, ...state.englishTrainer.exercises.filter((item) => item.id !== normalized.id)].slice(0, 30);
  els.englishTrainerAnswerInput.value = "";
  saveCards();
  renderEnglishTrainer();
}

async function createEnglishTrainerExercise() {
  if (els.createEnglishTrainerExerciseButton.disabled) return;
  state.englishTrainer = normalizeEnglishTrainerState(state.englishTrainer);
  if (!englishTrainerVocabularyForExercise().length) {
    setEnglishTrainerStatus("В выбранных папках нет слов для задания. Выберите другие папки или добавьте карточки.", "warn");
    return;
  }

  els.createEnglishTrainerExerciseButton.disabled = true;
  els.englishTrainerFolderChoices.disabled = true;
  els.openTrainerCardSelectionButton.disabled = true;
  const { count, mode } = englishTrainerExerciseSettings();
  try {
    setEnglishTrainerStatus("AI создает английское задание.", "work");
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const exercise = await fetchEnglishTrainerExercise(count, mode);
    activateEnglishTrainerExercise(exercise);
    setEnglishTrainerStatus("Задание готово.", "ok");
  } catch (error) {
    setEnglishTrainerStatus(`Не получилось создать задание: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.createEnglishTrainerExerciseButton.disabled = false;
    els.englishTrainerFolderChoices.disabled = false;
    els.openTrainerCardSelectionButton.disabled = false;
  }
}

async function startEnglishTrainerManualPrompt() {
  const promptRu = normalizeFreeText(els.englishTrainerManualPromptInput.value, 620);
  if (!promptRu) {
    setEnglishTrainerStatus("Напиши русский текст для перевода.", "warn");
    els.englishTrainerManualPromptInput.focus();
    return;
  }

  els.startEnglishTrainerManualPromptButton.disabled = true;
  setEnglishTrainerStatus("AI готовит подсказки к твоему тексту.", "work");
  try {
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const data = await requestPolishApi("/api/english/sentence-trainer/prepare-manual", {
      promptRu,
      words: englishTrainerVocabularyForExercise(),
    });
    activateEnglishTrainerExercise({
      ...(data.exercise || {}),
      promptRu,
      mode: "manual",
      targetCount: 10,
    }, { revealHints: true });
    setEnglishTrainerStatus("Свой текст готов с подсказками. Напиши ответ по-английски.", "ok");
  } catch (error) {
    activateEnglishTrainerExercise({
      promptRu,
      expectedEn: "",
      hint: "Сначала переведи сам. AI проверит ответ и предложит естественный английский вариант.",
      mode: "manual",
      targetCount: 10,
      usedWords: [],
      grammarFocus: ["свой текст"],
    }, { revealHints: true });
    setEnglishTrainerStatus(`Свой текст создан без AI-подсказок: ${friendlyError(error.message)}.`, "warn");
  } finally {
    els.startEnglishTrainerManualPromptButton.disabled = false;
    els.englishTrainerManualPromptInput.value = "";
    closeEnglishTrainerTextDialog();
    els.englishTrainerAnswerInput.focus();
  }
}

function renderEnglishTrainerExercise() {
  const exercise = normalizeEnglishTrainerExercise(state.englishTrainer.currentExercise || {});
  els.englishTrainerExerciseCard.hidden = !exercise;
  if (!exercise) return;
  els.englishTrainerPromptRu.textContent = exercise.promptRu;
  els.englishTrainerExerciseHint.textContent = exercise.hint || "Используй свои слова из базы. Служебные слова можно добавлять по смыслу.";
  els.englishTrainerExerciseHint.classList.toggle("is-hidden", !state.englishTrainerHintVisible);
  els.englishTrainerExerciseHint.setAttribute("role", "button");
  els.englishTrainerExerciseHint.setAttribute("tabindex", "0");
  els.englishTrainerExerciseHint.setAttribute("aria-label", state.englishTrainerHintVisible ? "Скрыть подсказку" : "Показать подсказку");
  els.englishTrainerUsedWords.replaceChildren();
  els.englishTrainerUsedWords.classList.toggle("is-hidden", !state.englishTrainerUsedWordsVisible);
  els.englishTrainerUsedWords.setAttribute("role", "button");
  els.englishTrainerUsedWords.setAttribute("tabindex", "0");
  els.englishTrainerUsedWords.setAttribute("aria-label", state.englishTrainerUsedWordsVisible ? "Скрыть слова-подсказки" : "Показать слова-подсказки");
  exercise.usedWords.forEach((word) => {
    const chip = document.createElement("span");
    chip.className = "polish-used-chip";
    chip.textContent = word;
    els.englishTrainerUsedWords.append(chip);
  });
}

function toggleEnglishTrainerHint() {
  if (!normalizeEnglishTrainerExercise(state.englishTrainer.currentExercise || {})) return;
  state.englishTrainerHintVisible = !state.englishTrainerHintVisible;
  renderEnglishTrainerExercise();
}

function toggleEnglishTrainerUsedWords() {
  if (!normalizeEnglishTrainerExercise(state.englishTrainer.currentExercise || {})) return;
  state.englishTrainerUsedWordsVisible = !state.englishTrainerUsedWordsVisible;
  renderEnglishTrainerExercise();
}

function renderEnglishTrainerFeedback() {
  const feedback = state.englishTrainer.feedback;
  els.englishTrainerFeedback.hidden = !feedback;
  els.englishTrainerFeedback.replaceChildren();
  if (!feedback) return;
  const title = document.createElement("h3");
  title.textContent = feedback.isCorrect ? "Похоже, всё правильно" : "Разбор ответа";
  const result = document.createElement("div");
  result.className = "polish-feedback-result";
  result.innerHTML = `<span>Оценка</span><strong>${Math.round(feedback.score)}%</strong><p>${escapeHtml(feedback.correctedAnswer || "")}</p>`;
  els.englishTrainerFeedback.append(title, result);
  if (Array.isArray(feedback.mistakes) && feedback.mistakes.length) {
    const list = document.createElement("ul");
    list.className = "polish-mistake-list";
    feedback.mistakes.forEach((mistake) => {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${escapeHtml(mistake.correct || "Исправление")}</strong><span>${escapeHtml(mistake.reasonRu || mistake.grammarPoint || "")}</span>`;
      list.append(item);
    });
    els.englishTrainerFeedback.append(list);
  }
  if (feedback.explanationRu) {
    const note = document.createElement("p");
    note.textContent = feedback.explanationRu;
    els.englishTrainerFeedback.append(note);
  }
}

async function checkEnglishTrainerAnswer() {
  const exercise = normalizeEnglishTrainerExercise(state.englishTrainer.currentExercise || {});
  const answer = normalizeFreeText(els.englishTrainerAnswerInput.value, 320);
  if (!exercise) {
    setEnglishTrainerStatus("Сначала создай задание.", "warn");
    return;
  }
  if (!answer) {
    setEnglishTrainerStatus("Напиши свой английский ответ.", "warn");
    els.englishTrainerAnswerInput.focus();
    return;
  }

  els.checkEnglishTrainerAnswerButton.disabled = true;
  setEnglishTrainerStatus("AI проверяет ответ и разбирает ошибки.", "work");
  try {
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const data = await requestPolishApi("/api/english/sentence-trainer/check-answer", {
      exercise,
      answer,
      words: englishTrainerVocabularyForExercise(),
    });
    state.englishTrainer.feedback = {
      userAnswer: answer,
      isCorrect: Boolean(data.isCorrect),
      score: Math.max(0, Math.min(100, Number(data.score) || 0)),
      correctedAnswer: normalizeFreeText(data.correctedAnswer || exercise.expectedEn, 320),
      mistakes: Array.isArray(data.mistakes) ? data.mistakes.slice(0, 8) : [],
      explanationRu: normalizeFreeText(data.explanationRu || "", 360),
    };
    saveCards();
    renderEnglishTrainer();
    setEnglishTrainerStatus(state.englishTrainer.feedback.isCorrect ? "Ответ засчитан." : "Разбор готов.", "ok");
  } catch (error) {
    setEnglishTrainerStatus(`Не получилось проверить ответ: ${friendlyError(error.message)}.`, "error");
  } finally {
    els.checkEnglishTrainerAnswerButton.disabled = false;
  }
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
  renderEnglishTrainer();
  setEnglishPractice(state.englishPractice);
  renderPolish();
  if (state.language === "polish") window.setTimeout(() => ensurePolishExerciseQueue({ silent: true }), 300);
}

function initLanguage() {
  setLanguage(localStorage.getItem(LANGUAGE_KEY) || "english");
}

function setEnglishPractice(practice) {
  state.englishPractice = practice === "sentences" ? "sentences" : "cards";
  const cards = state.englishPractice === "cards";
  els.englishCardsPractice.hidden = !cards;
  els.englishSentencesPractice.hidden = cards;
  els.englishCardsTab.classList.toggle("is-active", cards);
  els.englishSentencesTab.classList.toggle("is-active", !cards);
  els.englishCardsTab.setAttribute("aria-pressed", String(cards));
  els.englishSentencesTab.setAttribute("aria-pressed", String(!cards));
  if (!cards) renderEnglishTrainer();
}

function openCreatorDialog() {
  closeDeckDialog();
  openAppDialog(els.cardCreatorDialog);
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
        partOfSpeech: word.includes(" ") ? "phrase" : inferPolishPartOfSpeech(word),
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

function polishWordsNeedAiDetails(words = []) {
  return words.some((word) => !word.translation || !word.partOfSpeech);
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
    if (shouldExtractPolishWordsWithAi(text) || polishWordsNeedAiDetails(words)) {
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

function boostPolishWord(wordId) {
  state.polish = normalizePolishState(state.polish);
  let boostedWord = "";
  let isBoosted = false;
  state.polish.words = state.polish.words.map((word) => {
    if (word.id !== wordId) return word;
    const boostRemaining = word.boostRemaining > 0 ? 0 : 8;
    boostedWord = word.word;
    isBoosted = boostRemaining > 0;
    return { ...word, boostRemaining };
  });
  state.polish.preparedExercises = [];
  saveCards();
  renderPolish();
  setPolishStatus(isBoosted ? `${boostedWord} будет чаще попадаться в заданиях.` : `${boostedWord} снова в обычном режиме.`, "ok");
  ensurePolishExerciseQueue({ silent: true });
}

function renderPolish() {
  if (!els.polishDictionarySummary) return;
  state.polish = normalizePolishState(state.polish);
  const wordCount = state.polish.words.length;
  els.polishDictionarySummary.textContent = `${wordCount} слов/фраз · Открыть`;
  els.polishDictionaryPreview.textContent = wordCount
    ? state.polish.words.slice(0, 6).map((word) => word.word).join(", ")
    : "Пока пусто";
  renderPolishDictionary();

  renderPolishExercise();
  renderPolishFeedback();
}

function polishWordType(word = {}) {
  const part = inferPolishPartOfSpeech(word.word, word.partOfSpeech);
  if (part) return part;
  return "other";
}

function polishWordTypeLabel(type) {
  return {
    verb: "Глагол",
    noun: "Существительное",
    phrase: "Фраза",
    adjective: "Прилагательное",
    other: "Слово",
  }[type] || "Слово";
}

function filteredPolishWords() {
  const queryTokens = normalizeSearchText(els.polishDictionarySearch?.value || "", 120)
    .split(/[,\s]+/)
    .filter(Boolean);
  const filter = els.polishDictionaryFilter?.value || "all";

  return normalizePolishState(state.polish).words.filter((word) => {
    const type = polishWordType(word);
    const haystack = normalizeSearchText([word.word, word.translation, polishWordTypeLabel(type), word.partOfSpeech, word.gender, word.notes].join(" "), 500);
    return (filter === "all" || type === filter) && (!queryTokens.length || queryTokens.every((token) => haystack.includes(token)));
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
    const boostRemaining = Math.max(0, Number(word.boostRemaining) || 0);
    row.classList.toggle("is-boosted", boostRemaining > 0);
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(word.word)}</h3>
        <p>${escapeHtml([word.translation || "перевод не добавлен", polishWordTypeLabel(type), word.gender, boostRemaining ? `чаще: ${boostRemaining}` : ""].filter(Boolean).join(" · "))}</p>
      </div>
    `;
    const boostButton = document.createElement("button");
    boostButton.type = "button";
    boostButton.className = "priority-word-button";
    boostButton.setAttribute("aria-label", boostRemaining ? `Убрать частое повторение слова ${word.word}` : `Повторять чаще слово ${word.word}`);
    boostButton.textContent = boostRemaining ? "★" : "☆";
    boostButton.addEventListener("click", () => boostPolishWord(word.id));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-card-button";
    deleteButton.setAttribute("aria-label", `Удалить слово ${word.word}`);
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => removePolishWord(word.id));
    row.append(boostButton);
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

function openPolishTextDialog() {
  openAppDialog(els.polishTextDialog);
  window.setTimeout(() => els.polishManualPromptInput?.focus(), 80);
}

function closePolishTextDialog() {
  closeAppDialog(els.polishTextDialog);
}

async function startPolishManualPrompt() {
  const promptRu = normalizeFreeText(els.polishManualPromptInput.value, 620);
  if (!promptRu) {
    setPolishStatus("Напиши русский текст для перевода.", "warn");
    els.polishManualPromptInput.focus();
    return;
  }

  els.startPolishManualPromptButton.disabled = true;
  setPolishStatus("AI готовит подсказки к твоему тексту.", "work");
  try {
    await updateAiStatus();
    if (!state.deepSeekOnline) throw new Error("DEEPSEEK_API_KEY is not set");
    const data = await requestPolishApi("/api/polish/prepare-manual", {
      promptRu,
      words: state.polish.words,
    });
    activatePolishExercise({
      ...(data.exercise || {}),
      promptRu,
      mode: "manual",
      targetCount: 10,
    });
    state.polishHintVisible = true;
    state.polishUsedWordsVisible = true;
    renderPolishExercise();
    setPolishStatus("Свой текст готов с подсказками. Напиши ответ по-польски.", "ok");
  } catch (error) {
    activatePolishExercise({
      promptRu,
      expectedPl: "",
      hint: "Сначала переведи сам. AI проверит ответ и предложит правильный польский вариант.",
      mode: "manual",
      targetCount: 10,
      usedWords: [],
      grammarFocus: ["свой текст"],
    });
    state.polishHintVisible = true;
    renderPolishExercise();
    setPolishStatus(`Свой текст создан без AI-подсказок: ${friendlyError(error.message)}.`, "warn");
  } finally {
    els.startPolishManualPromptButton.disabled = false;
    els.polishManualPromptInput.value = "";
    closePolishTextDialog();
    els.polishAnswerInput.focus();
  }
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
  els.polishUsedWords.classList.toggle("is-hidden", !state.polishUsedWordsVisible);
  els.polishUsedWords.setAttribute("role", "button");
  els.polishUsedWords.setAttribute("tabindex", "0");
  els.polishUsedWords.setAttribute("aria-label", state.polishUsedWordsVisible ? "Скрыть слова-подсказки" : "Показать слова-подсказки");
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

function togglePolishUsedWords() {
  if (!normalizePolishExercise(state.polish.currentExercise || {})) return;
  state.polishUsedWordsVisible = !state.polishUsedWordsVisible;
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

function polishVocabularyForExercise() {
  state.polish = normalizePolishState(state.polish);
  const words = [...state.polish.words];
  const boosted = words
    .filter((word) => (Number(word.boostRemaining) || 0) > 0)
    .sort((left, right) => (right.boostRemaining || 0) - (left.boostRemaining || 0));
  const regular = words
    .filter((word) => !(Number(word.boostRemaining) || 0))
    .sort(() => Math.random() - 0.5);
  return [...boosted, ...regular].slice(0, 200);
}

async function fetchPolishExercise(count, mode) {
  const data = await requestPolishApi("/api/polish/create-exercise", {
    words: polishVocabularyForExercise(),
    focusWords: state.polish.words.filter((word) => (Number(word.boostRemaining) || 0) > 0).map((word) => word.word).slice(0, 12),
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
  state.polishUsedWordsVisible = false;
  state.polish.feedback = null;
  const usedKeys = new Set(normalized.usedWords.map(polishWordKey));
  state.polish.words = normalizePolishState(state.polish).words.map((word) => {
    if (!usedKeys.has(polishWordKey(word.word)) || !(Number(word.boostRemaining) > 0)) return word;
    return { ...word, boostRemaining: Math.max(0, Number(word.boostRemaining) - 1) };
  });
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
  openCreatorDialog();
  els.manualPhraseInput.focus();
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

  state.profileSyncReady = false;
  rememberProfileId(cleanProfileId);
  loadLocalCards();
  renderStudy(0);
  syncGoalDialog();
  setStatus(`Открыт профиль ${state.profileId}.`, "ok");

  try {
    await loadServerCards();
  } catch {
    await loadOfflineStarterCards();
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
  if (state.studySettings.selection) {
    const selection = state.studySettings.selection;
    state.studySettings = { ...state.studySettings, selection: {
      ...selection,
      folderPaths: selection.folderPaths.map((folder) => folder === oldFolder || folder.startsWith(`${oldFolder} / `)
        ? `${newFolder}${folder.slice(oldFolder.length)}` : folder),
    }, updatedAt: Math.max(Date.now(), state.studySettings.updatedAt + 1) };
  }

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
  const selection = normalizeEnglishTrainerState(state.englishTrainer).folderPaths;
  if (selection.some((folder) => folder === oldFolder || folder.startsWith(`${oldFolder} / `))) {
    setEnglishTrainerFolders(selection.map((folder) => folder === oldFolder || folder.startsWith(`${oldFolder} / `)
      ? `${newFolder}${folder.slice(oldFolder.length)}` : folder));
  }
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
  if (state.studySettings.selection) {
    const selection = state.studySettings.selection;
    state.studySettings = { ...state.studySettings, selection: {
      folderPaths: selection.folderPaths.filter((path) => !matchesDeletedFolder(path)),
      cardIds: selection.cardIds === null ? null : selection.cardIds.filter((id) => !deletedCardIds.has(id)),
    }, updatedAt: Math.max(Date.now(), state.studySettings.updatedAt + 1) };
  }
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
  const selection = normalizeEnglishTrainerState(state.englishTrainer).folderPaths;
  if (selection.some(matchesDeletedFolder)) {
    setEnglishTrainerFolders(selection.filter((folder) => !matchesDeletedFolder(folder)));
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
els.studyModeButtons.forEach((button) => button.addEventListener("click", () => setStudyMode(button.dataset.studyMode)));
els.flashcard.addEventListener("keydown", (event) => {
  if (event.target !== els.flashcard || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  flipCard();
});
els.againButton.addEventListener("click", () => rateCard(false));
els.gotItButton.addEventListener("click", () => rateCard(true));
swipes.attach();
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
els.openStudyFoldersButton.addEventListener("click", () => openPracticeSelection("cards"));
els.openTrainerCardSelectionButton.addEventListener("click", () => openPracticeSelection("sentences"));
document.querySelector("#closePracticeSelectionButton").addEventListener("click", () => closeAppDialog(els.practiceSelectionDialog));
els.practiceSelectionDialog.addEventListener("click", (event) => {
  if (event.target === els.practiceSelectionDialog) closeAppDialog(els.practiceSelectionDialog);
});
els.startBasicActionsButton.addEventListener("click", startBasicActions);
els.openCreatorButton.addEventListener("click", openCreatorDialog);
els.closeCreatorButton.addEventListener("click", () => closeAppDialog(els.cardCreatorDialog));
els.cardCreatorDialog.addEventListener("click", (event) => {
  if (event.target === els.cardCreatorDialog) closeAppDialog(els.cardCreatorDialog);
});
els.englishCardsTab.addEventListener("click", () => setEnglishPractice("cards"));
els.englishSentencesTab.addEventListener("click", () => setEnglishPractice("sentences"));
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
els.addEnglishTrainerWordsButton.addEventListener("click", addEnglishTrainerWordsFromInput);
els.suggestEnglishTrainerWordsButton.addEventListener("click", suggestEnglishTrainerWords);
els.openEnglishTrainerDictionaryButton.addEventListener("click", openEnglishTrainerDictionary);
els.closeEnglishTrainerDictionaryButton.addEventListener("click", closeEnglishTrainerDictionary);
els.englishTrainerDictionarySearch.addEventListener("input", renderEnglishTrainerDictionary);
els.englishTrainerDictionaryFilter.addEventListener("change", renderEnglishTrainerDictionary);
els.englishTrainerDictionaryDialog.addEventListener("click", (event) => {
  if (event.target === els.englishTrainerDictionaryDialog) closeEnglishTrainerDictionary();
});
els.createEnglishTrainerExerciseButton.addEventListener("click", createEnglishTrainerExercise);
els.englishTrainerFolderChoices.addEventListener("change", changeEnglishTrainerFolder);
els.openEnglishTrainerTextButton.addEventListener("click", openEnglishTrainerTextDialog);
els.closeEnglishTrainerTextButton.addEventListener("click", closeEnglishTrainerTextDialog);
els.startEnglishTrainerManualPromptButton.addEventListener("click", startEnglishTrainerManualPrompt);
els.englishTrainerTextDialog.addEventListener("click", (event) => {
  if (event.target === els.englishTrainerTextDialog) closeEnglishTrainerTextDialog();
});
els.checkEnglishTrainerAnswerButton.addEventListener("click", checkEnglishTrainerAnswer);
els.englishTrainerExerciseHint.addEventListener("click", toggleEnglishTrainerHint);
els.englishTrainerExerciseHint.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  toggleEnglishTrainerHint();
});
els.englishTrainerUsedWords.addEventListener("click", toggleEnglishTrainerUsedWords);
els.englishTrainerUsedWords.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  toggleEnglishTrainerUsedWords();
});
els.openPolishTextButton.addEventListener("click", openPolishTextDialog);
els.closePolishTextButton.addEventListener("click", closePolishTextDialog);
els.startPolishManualPromptButton.addEventListener("click", startPolishManualPrompt);
els.polishTextDialog.addEventListener("click", (event) => {
  if (event.target === els.polishTextDialog) closePolishTextDialog();
});
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
els.polishUsedWords.addEventListener("click", togglePolishUsedWords);
els.polishUsedWords.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  togglePolishUsedWords();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

initProfile();
initLanguage();
loadLocalCards();
renderStudy(0);
renderEnglishTrainer();
renderPolish();
syncGoalDialog();
loadServerCards().catch(loadOfflineStarterCards);
updateAiStatus();
updateSpeechControls();
updatePhraseMode();
updateSongLyricsLinks();
setInterval(updateAiStatus, 10000);

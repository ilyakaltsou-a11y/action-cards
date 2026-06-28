const TEXT_MODEL = "gpt-5.4-mini";
const DEEPSEEK_MODEL = "deepseek-chat";
const IMAGE_MODEL = "gpt-image-1-mini";
const IMAGE_QUALITY = "medium";
const TEXT_TIMEOUT = 45 * 1000;
const DEEPSEEK_TIMEOUT = 45 * 1000;
const IMAGE_TIMEOUT = 120 * 1000;
const MAX_SONG_LINES = 24;
const IMAGE_CONCURRENCY = 6;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/api/status") {
        return json({
          aiReady: Boolean(env.OPENAI_API_KEY),
          deepSeekReady: Boolean(env.DEEPSEEK_API_KEY),
          textModel: env.TEXT_MODEL || TEXT_MODEL,
          deepSeekModel: env.DEEPSEEK_MODEL || DEEPSEEK_MODEL,
          imageModel: env.IMAGE_MODEL || IMAGE_MODEL,
          imageQuality: env.IMAGE_QUALITY || IMAGE_QUALITY,
        });
      }

      if (request.method === "POST" && url.pathname === "/api/create-card") {
        return handleCreateCard(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/create-song-cards") {
        return handleCreateSongCards(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/song-options") {
        return handleSongOptions(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/polish/suggest-words") {
        return handlePolishSuggestWords(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/polish/extract-words") {
        return handlePolishExtractWords(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/polish/create-exercise") {
        return handlePolishCreateExercise(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/polish/check-answer") {
        return handlePolishCheckAnswer(request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/cards") {
        return handleGetCards(url, env);
      }

      if (request.method === "PUT" && url.pathname === "/api/cards") {
        return handleSaveCards(request, env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/images/")) {
        return handleImage(url, env);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error.name === "TimeoutError" || error.name === "AbortError"
        ? "AI timeout"
        : error.message || "Server error";
      return json({ error: message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanWord(word) {
  return String(word || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z -]/g, "")
    .replace(/\s+/g, " ");
}

function cleanPreference(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 260);
}

function cleanTitle(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function cleanPolishWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźż -]/gi, "")
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

function cleanProfile(profile) {
  return String(profile || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

function slugify(text) {
  return cleanWord(text).replace(/\s+/g, "-").replace(/^-|-$/g, "") || "card";
}

function normalizePhraseKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’`´]/g, "'")
    .replace(/\[[^\]]+\]|\([^)]+\)/g, " ")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;

  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
}

function timeoutSignal(milliseconds) {
  return AbortSignal.timeout(milliseconds);
}

function imageConcurrency(env) {
  return Math.max(1, Math.min(8, Number(env.IMAGE_CONCURRENCY) || IMAGE_CONCURRENCY));
}

async function deepseekJson(env, messages) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal: timeoutSignal(DEEPSEEK_TIMEOUT),
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || DEEPSEEK_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
}

async function findSongOptions(env, query) {
  const result = await deepseekJson(env, [
    {
      role: "system",
      content: [
        "You identify likely songs from a rough title, artist, or short user clue.",
        "Return only JSON.",
        "Do not provide, quote, reconstruct, continue, or summarize song lyrics.",
        "If the user included a lyric-like clue, use it only to identify possible songs and do not repeat it.",
        "Return up to 5 candidates with artist, title, confidence, and a short Russian reason.",
      ].join(" "),
    },
    { role: "user", content: JSON.stringify({ query }) },
  ]);

  return Array.isArray(result.candidates)
    ? result.candidates
        .map((candidate) => ({
          artist: cleanTitle(candidate.artist),
          title: cleanTitle(candidate.title),
          confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)),
          reason: String(candidate.reason || "").trim().replace(/\s+/g, " ").slice(0, 160),
        }))
        .filter((candidate) => candidate.artist || candidate.title)
        .slice(0, 5)
    : [];
}

function normalizePolishWords(words = []) {
  const seen = new Set();
  return (Array.isArray(words) ? words : [])
    .map((entry) => {
      const word = cleanPolishWord(entry.word || entry.polish || entry);
      if (!word || seen.has(word)) return null;
      seen.add(word);
      return {
        word,
        translation: cleanTitle(entry.translation || entry.ru || ""),
        partOfSpeech: cleanTitle(entry.partOfSpeech || entry.pos || ""),
        gender: cleanTitle(entry.gender || ""),
        level: cleanTitle(entry.level || "A1"),
        notes: String(entry.notes || "").trim().replace(/\s+/g, " ").slice(0, 180),
        forms: entry.forms && typeof entry.forms === "object" ? entry.forms : {},
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

async function suggestPolishWords(env, existingWords = [], count = 10) {
  const cleanExistingWords = existingWords.map(cleanPolishWord).filter(Boolean).slice(0, 200);
  const requestedCount = Math.max(1, Math.min(20, Number(count) || 10));
  const result = await deepseekJson(env, [
    {
      role: "system",
      content: [
        "You are a careful Polish teacher for a Russian-speaking adult beginner.",
        "Return only JSON exactly as {\"words\":[...]} .",
        "Suggest practical Polish vocabulary for sentence-building practice.",
        "Avoid words already listed by the learner.",
        "Never return an empty list unless every A1-A2 word is already listed.",
        "Prefer A1-A2 everyday words and verbs that combine well in simple sentences.",
        "For each word return: word, Russian translation, partOfSpeech, gender if relevant, level, short Russian notes, and useful forms object when useful.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        existingWords: cleanExistingWords,
        count: requestedCount,
      }),
    },
  ]);

  const words = normalizePolishWords(result.words || result.vocabulary || result.items || result.suggestions || result.entries);
  if (words.length) return words.slice(0, requestedCount);

  return fallbackPolishWords(cleanExistingWords, requestedCount);
}

function fallbackPolishWords(existingWords = [], count = 10) {
  const existing = new Set(existingWords.map(cleanPolishWord));
  return normalizePolishWords([
    { word: "być", translation: "быть", partOfSpeech: "verb", level: "A1", notes: "самый важный глагол", forms: { present: "jestem, jesteś, jest, jesteśmy, jesteście, są" } },
    { word: "mieć", translation: "иметь", partOfSpeech: "verb", level: "A1", notes: "часто нужен для простых предложений" },
    { word: "robić", translation: "делать", partOfSpeech: "verb", level: "A1", notes: "базовый глагол действия" },
    { word: "iść", translation: "идти", partOfSpeech: "verb", level: "A1", notes: "движение пешком" },
    { word: "jeść", translation: "есть", partOfSpeech: "verb", level: "A1", notes: "еда" },
    { word: "pić", translation: "пить", partOfSpeech: "verb", level: "A1", notes: "напитки" },
    { word: "dom", translation: "дом", partOfSpeech: "noun", gender: "męski", level: "A1" },
    { word: "praca", translation: "работа", partOfSpeech: "noun", gender: "żeński", level: "A1" },
    { word: "sklep", translation: "магазин", partOfSpeech: "noun", gender: "męski", level: "A1" },
    { word: "dziecko", translation: "ребёнок", partOfSpeech: "noun", gender: "nijaki", level: "A1" },
    { word: "rodzina", translation: "семья", partOfSpeech: "noun", gender: "żeński", level: "A1" },
    { word: "przyjaciel", translation: "друг", partOfSpeech: "noun", gender: "męski", level: "A1" },
  ].filter((entry) => !existing.has(cleanPolishWord(entry.word)))).slice(0, count);
}

async function extractPolishWords(env, text = "", existingWords = []) {
  const result = await deepseekJson(env, [
    {
      role: "system",
      content: [
        "You extract useful Polish vocabulary from learner-provided Polish text.",
        "Return only JSON exactly as {\"words\":[...]} .",
        "The learner may paste one sentence or several sentences.",
        "If the text contains Polish words, do not return an empty list.",
        "Extract dictionary/base forms, not only surface forms.",
        "For example, from 'Robię pracę domową z dzieckiem' extract robić, praca domowa, dziecko.",
        "Include short useful two-word chunks when they behave like a phrase or are learned together.",
        "Skip punctuation, names, duplicates, and words already listed.",
        "For each item return: word, Russian translation, partOfSpeech, gender if relevant, level, short Russian notes, and useful forms object when useful.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        text: String(text || "").trim().slice(0, 1200),
        existingWords: existingWords.map(cleanPolishWord).filter(Boolean).slice(0, 200),
      }),
    },
  ]);

  return normalizePolishWords(result.words || result.vocabulary || result.items || result.entries).slice(0, 30);
}

async function createPolishExercise(env, words = [], count = 7, mode = "medium", recentExercises = []) {
  const vocabulary = normalizePolishWords(words).slice(0, 120);
  const selectedCount = Math.max(3, Math.min(10, Number(count) || 7));
  const cleanMode = ["easy", "medium", "hard"].includes(mode) ? mode : "medium";
  const result = await deepseekJson(env, [
    {
      role: "system",
      content: [
        "You create one Russian-to-Polish translation exercise.",
        "Return only JSON.",
        "The learner is Russian-speaking and studies Polish grammar through sentence generation.",
        "Use mostly the learner's active vocabulary.",
        "Easy mode: about 90% learner vocabulary plus necessary function words.",
        "Medium mode: use learner vocabulary and train one or two new grammatical forms.",
        "Hard mode: use learner vocabulary with cases, tense, pronouns, or word order challenges.",
        "The Russian prompt must be natural and clear.",
        "The expected Polish answer must be one natural sentence.",
        "Do not overload with rare new vocabulary. Add only obvious service words when necessary.",
        "Avoid repeating the recent prompts, themes, and sentence patterns. Create a visibly different situation each time.",
        "Use at least 3 words from the provided vocabulary when possible.",
        "Return exercise with promptRu, expectedPl, usedWords, grammarFocus, and hint in Russian.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        vocabulary,
        count: selectedCount,
        mode: cleanMode,
        recentExercises: Array.isArray(recentExercises) ? recentExercises.slice(0, 8) : [],
        randomSeed: crypto.randomUUID(),
      }),
    },
  ]);

  const exercise = result.exercise || result;
  return {
    promptRu: cleanTitle(exercise.promptRu).slice(0, 260),
    expectedPl: String(exercise.expectedPl || "").trim().replace(/\s+/g, " ").slice(0, 260),
    usedWords: Array.isArray(exercise.usedWords) ? exercise.usedWords.map(cleanPolishWord).filter(Boolean).slice(0, 16) : [],
    grammarFocus: Array.isArray(exercise.grammarFocus) ? exercise.grammarFocus.map((item) => cleanTitle(item).slice(0, 100)).filter(Boolean).slice(0, 8) : [],
    hint: String(exercise.hint || "").trim().replace(/\s+/g, " ").slice(0, 220),
  };
}

async function checkPolishAnswer(env, exercise = {}, answer = "", words = []) {
  const result = await deepseekJson(env, [
    {
      role: "system",
      content: [
        "You check a Russian-to-Polish sentence exercise.",
        "Return only JSON.",
        "Be strict about Polish cases, verb conjugation, adjective agreement, prepositions, and word order, but accept natural alternative Polish phrasing.",
        "Explain mistakes in Russian in a short practical way.",
        "Return isCorrect, score 0-100, correctedAnswer, mistakes array, and explanationRu.",
        "Each mistake should include user, correct, reasonRu, and grammarPoint.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        exercise,
        learnerAnswer: String(answer || "").trim().replace(/\s+/g, " ").slice(0, 320),
        activeVocabulary: normalizePolishWords(words).slice(0, 120),
      }),
    },
  ]);

  return {
    isCorrect: Boolean(result.isCorrect),
    score: Math.max(0, Math.min(100, Number(result.score) || 0)),
    correctedAnswer: String(result.correctedAnswer || exercise.expectedPl || "").trim().replace(/\s+/g, " ").slice(0, 320),
    mistakes: Array.isArray(result.mistakes)
      ? result.mistakes.map((mistake) => ({
          user: String(mistake.user || "").trim().slice(0, 120),
          correct: String(mistake.correct || "").trim().slice(0, 120),
          reasonRu: String(mistake.reasonRu || "").trim().replace(/\s+/g, " ").slice(0, 240),
          grammarPoint: String(mistake.grammarPoint || "").trim().slice(0, 80),
        })).slice(0, 8)
      : [],
    explanationRu: String(result.explanationRu || "").trim().replace(/\s+/g, " ").slice(0, 420),
  };
}

async function openaiResponses(env, body) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: timeoutSignal(TEXT_TIMEOUT),
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenAI text failed: ${response.status}`);
  }

  return response.json();
}

async function createPhrase(env, word, existingPhrases = [], imagePreference = "") {
  const data = await openaiResponses(env, {
    model: env.TEXT_MODEL || TEXT_MODEL,
    input: [
      {
        role: "system",
        content: [
          "You create English-only flashcards for language learning.",
          "Return only JSON that matches the schema.",
          "Choose a natural phrase that an English speaker would actually say.",
          "Return the phrase as exactly one natural English sentence.",
          "The target word must appear naturally in the phrase at least once.",
          "Keep the sentence about 8 to 16 words so it is useful for listening practice.",
          "The sentence should describe one everyday moment that can be shown in a single picture.",
          "Return a clear Russian translation of the English sentence.",
          "Do not return generic patterns like 'use X', 'using X', or 'a person using X'.",
          "Make each result varied: different object, setting, verb pattern, or everyday context.",
          "The image scene must be concrete, visible, and easy to understand without text.",
          "If the learner gives visual preferences, use them only when they keep the scene clear, natural, and faithful to the sentence.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          word,
          avoidPhrases: existingPhrases.slice(0, 40),
          visualPreference: imagePreference,
          randomSeed: crypto.randomUUID(),
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "action_flashcard",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            phrase: {
              type: "string",
              description: "Exactly one natural English sentence, about 8 to 16 words, using the target word naturally.",
            },
            translation: {
              type: "string",
              description: "A natural Russian translation of the English sentence.",
            },
            scene: { type: "string" },
          },
          required: ["phrase", "translation", "scene"],
        },
      },
    },
  });

  return JSON.parse(extractResponseText(data));
}

async function createDetailsFromManualPhrase(env, word, phrase, imagePreference = "") {
  const data = await openaiResponses(env, {
    model: env.TEXT_MODEL || TEXT_MODEL,
    input: [
      {
        role: "system",
        content:
          "Return only JSON. Convert the user's English phrase into one concrete visual scene for an educational flashcard. No text should appear in the image. Also return a clear Russian translation of the English phrase. If the learner gives visual preferences, include them only when they make the scene clearer and still match the phrase.",
      },
      { role: "user", content: JSON.stringify({ word, phrase, visualPreference: imagePreference }) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "manual_phrase_scene",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            scene: { type: "string" },
            translation: {
              type: "string",
              description: "A natural Russian translation of the English phrase.",
            },
          },
          required: ["scene", "translation"],
        },
      },
    },
  });

  return JSON.parse(extractResponseText(data));
}

async function createSongPhraseDrafts(env, songTitle) {
  if (env.DEEPSEEK_API_KEY) {
    const result = await deepseekJson(env, [
      {
        role: "system",
        content: [
          "Create English learning flashcards from the broad meaning, mood, and themes of a known song.",
          "Do not provide, quote, paraphrase, reconstruct, continue, or summarize any lyrics.",
          "Do not claim to have fetched the lyrics.",
          "Return only JSON with exactly 8 original B1-level everyday English sentence cards.",
          "Each sentence must be 7 to 14 words and easy to show as one picture.",
          "Each card needs a target word, original phrase, Russian translation, and concrete visual scene.",
          "The cards should feel inspired by the song's general emotion and story, not copied from it.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify({ songTitle }) },
    ]);

    return dedupeSongDrafts(Array.isArray(result.cards) ? result.cards : []);
  }

  const data = await openaiResponses(env, {
    model: env.TEXT_MODEL || TEXT_MODEL,
    input: [
      {
        role: "system",
        content: [
          "Create original English flashcards inspired only by a song title or artist name.",
          "Do not quote, continue, summarize, paraphrase, reconstruct, or imitate any real song lyrics.",
          "Return exactly 6 original everyday English sentences.",
          "Each sentence must be 7 to 14 words and easy to show as one picture.",
          "Return a Russian translation and a concrete visual scene for each sentence.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify({ songTitle, randomSeed: crypto.randomUUID() }) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "song_flashcards",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            cards: {
              type: "array",
              minItems: 6,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  word: { type: "string" },
                  phrase: { type: "string" },
                  translation: { type: "string" },
                  scene: { type: "string" },
                },
                required: ["word", "phrase", "translation", "scene"],
              },
            },
          },
          required: ["cards"],
        },
      },
    },
  });

  return JSON.parse(extractResponseText(data)).cards || [];
}

async function createSongLineDrafts(env, songTitle, lines = [], existingPhrases = [], existingWords = []) {
  const seenLineKeys = new Set(existingPhrases.map(normalizePhraseKey).filter(Boolean));
  const cleanLines = [];

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim().replace(/\s+/g, " ").slice(0, 180);
    const lineKey = normalizePhraseKey(line);
    if (line.split(/\s+/).length < 3 || !lineKey || seenLineKeys.has(lineKey)) continue;
    seenLineKeys.add(lineKey);
    cleanLines.push(line);
    if (cleanLines.length >= MAX_SONG_LINES) break;
  }

  if (!cleanLines.length) return [];
  const avoidWords = existingWords.map(cleanWord).filter(Boolean).slice(0, 200);

  const data = await openaiResponses(env, {
    model: env.TEXT_MODEL || TEXT_MODEL,
    input: [
      {
        role: "system",
        content: [
          "Create flashcards from user-provided song lines.",
          "The user supplied the lines, so you may use each selected line as the English phrase.",
          "Return useful learning cards only: skip repeated or near-duplicate phrases and skip cards whose target word repeats an earlier target word.",
          "Do not use target words from the avoidWords list.",
          "Choose one clear B1-level target word from each phrase.",
          "Prefer concrete lines that can be shown in one picture.",
          "Keep the phrase as one natural English sentence or line, with no added lyric continuation.",
          "Return a natural Russian translation and a very concrete vertical phone-first visual scene.",
          "No text should appear in the image scene.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify({ songTitle, lines: cleanLines, maxCards: cleanLines.length, avoidWords }) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "song_line_flashcards",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            cards: {
              type: "array",
              minItems: 1,
              maxItems: MAX_SONG_LINES,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  word: { type: "string" },
                  phrase: { type: "string" },
                  translation: { type: "string" },
                  scene: { type: "string" },
                },
                required: ["word", "phrase", "translation", "scene"],
              },
            },
          },
          required: ["cards"],
        },
      },
    },
  });

  return dedupeSongDrafts(JSON.parse(extractResponseText(data)).cards || [], existingPhrases, existingWords);
}

function dedupeSongDrafts(drafts = [], existingPhrases = [], existingWords = []) {
  const seenWords = new Set(existingWords.map(cleanWord).filter(Boolean));
  const seenPhrases = new Set(existingPhrases.map(normalizePhraseKey).filter(Boolean));
  const cards = [];

  for (const draft of drafts) {
    const word = cleanWord(draft.word) || slugify(draft.phrase).split("-")[0] || "song";
    const phrase = String(draft.phrase || "").trim().replace(/\s+/g, " ");
    const phraseKey = normalizePhraseKey(phrase);
    if (!phrase || seenWords.has(word) || seenPhrases.has(phraseKey)) continue;
    seenWords.add(word);
    seenPhrases.add(phraseKey);
    cards.push({ ...draft, word, phrase });
  }

  return cards.slice(0, MAX_SONG_LINES);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

async function createImage(env, scene, word, imagePreference = "") {
  const prompt = [
    "Modern friendly educational flashcard illustration.",
    "Vertical portrait 2:3 composition for a phone flashcard, main action centered and fully visible.",
    "Clean app-quality style, soft natural colors, clear action, no text, no watermark.",
    "The action must be understandable on a phone screen.",
    `Scene: ${scene}`,
    imagePreference ? `Learner visual preference to consider if compatible: ${imagePreference}` : "",
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    signal: timeoutSignal(IMAGE_TIMEOUT),
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.IMAGE_MODEL || IMAGE_MODEL,
      prompt,
      size: "1024x1536",
      quality: env.IMAGE_QUALITY || IMAGE_QUALITY,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI image failed: ${response.status}`);
  }

  const data = await response.json();
  const image = data.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenAI image returned no b64_json");
  }

  const bytes = Uint8Array.from(atob(image.b64_json), (char) => char.charCodeAt(0));
  const key = `${slugify(word)}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
  await env.CARDS_KV.put(`image:${key}`, bytes.buffer);
  return `/images/${key}`;
}

async function handleCreateSongCards(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY is not set" }, 503);
  }

  const body = await request.json();
  const songTitle = cleanTitle(body.songTitle);
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const existingPhrases = Array.isArray(body.existingPhrases) ? body.existingPhrases : [];
  const existingWords = Array.isArray(body.existingWords) ? body.existingWords : [];
  if (!songTitle && !lines.length) {
    return json({ error: "Song title is required" }, 400);
  }

  const phraseDrafts = lines.length ? await createSongLineDrafts(env, songTitle, lines, existingPhrases, existingWords) : await createSongPhraseDrafts(env, songTitle);
  const cards = await mapWithConcurrency(phraseDrafts, imageConcurrency(env), async (draft) => {
    const word = cleanWord(draft.word) || slugify(draft.phrase).split("-")[0] || "song";
    const imageContext = lines.length
      ? `Song study from user-provided lines: ${songTitle || "untitled song"}. Vertical phone-first image. Do not include text.`
      : `Original flashcard inspired by title: ${songTitle}. Do not include text.`;
    const imageUrl = await createImage(env, draft.scene, word, imageContext);
    return { ...draft, word, imageUrl, imagePreference: songTitle };
  });
  return json({ cards });
}

async function handleCreateCard(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY is not set" }, 503);
  }

  const body = await request.json();
  const word = cleanWord(body.word);
  if (!word) {
    return json({ error: "Word is required" }, 400);
  }

  const manualPhrase = String(body.phrase || "").trim().replace(/\s+/g, " ");
  const imagePreference = cleanPreference(body.imagePreference);
  const phraseDraft = manualPhrase
    ? { phrase: manualPhrase, ...(await createDetailsFromManualPhrase(env, word, manualPhrase, imagePreference)) }
    : await createPhrase(env, word, Array.isArray(body.existingPhrases) ? body.existingPhrases : [], imagePreference);

  const imageUrl = await createImage(env, phraseDraft.scene, word, imagePreference);
  return json({
    word,
    phrase: phraseDraft.phrase,
    translation: phraseDraft.translation,
    scene: phraseDraft.scene,
    imagePreference,
    imageUrl,
  });
}

async function handleSongOptions(request, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return json({ error: "DEEPSEEK_API_KEY is not set" }, 503);
  }

  const body = await request.json();
  const query = String(body.query || "").trim().replace(/\s+/g, " ").slice(0, 240);
  if (!query) {
    return json({ error: "Song query is required" }, 400);
  }

  const candidates = await findSongOptions(env, query);
  return json({ candidates });
}

async function handlePolishSuggestWords(request, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return json({ error: "DEEPSEEK_API_KEY is not set" }, 503);
  }

  const body = await request.json();
  const words = await suggestPolishWords(env, Array.isArray(body.existingWords) ? body.existingWords : [], body.count);
  return json({ words });
}

async function handlePolishExtractWords(request, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return json({ error: "DEEPSEEK_API_KEY is not set" }, 503);
  }

  const body = await request.json();
  const text = String(body.text || "").trim().slice(0, 1200);
  if (!text) {
    return json({ error: "Text is required" }, 400);
  }
  const words = await extractPolishWords(env, text, Array.isArray(body.existingWords) ? body.existingWords : []);
  return json({ words });
}

async function handlePolishCreateExercise(request, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return json({ error: "DEEPSEEK_API_KEY is not set" }, 503);
  }

  const body = await request.json();
  const exercise = await createPolishExercise(
    env,
    Array.isArray(body.words) ? body.words : [],
    body.count,
    body.mode,
    Array.isArray(body.recentExercises) ? body.recentExercises : []
  );
  return json({ exercise });
}

async function handlePolishCheckAnswer(request, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return json({ error: "DEEPSEEK_API_KEY is not set" }, 503);
  }

  const body = await request.json();
  const answer = String(body.answer || "").trim().replace(/\s+/g, " ").slice(0, 320);
  if (!answer) {
    return json({ error: "Answer is required" }, 400);
  }
  const feedback = await checkPolishAnswer(env, body.exercise || {}, answer, Array.isArray(body.words) ? body.words : []);
  return json(feedback);
}

async function handleGetCards(url, env) {
  const profile = cleanProfile(url.searchParams.get("profile"));
  if (!profile) {
    return json({ error: "Profile is required" }, 400);
  }

  const data = await env.CARDS_KV.get(`profile:${profile}`, "json");
  return json({
    cards: Array.isArray(data?.cards) ? data.cards : [],
    folders: Array.isArray(data?.folders) ? data.folders : [],
    activity: data?.activity && typeof data.activity === "object" ? data.activity : { days: {}, updatedAt: 0 },
    polish: data?.polish && typeof data.polish === "object" ? data.polish : { words: [], exercises: [], currentExercise: null },
  });
}

async function handleSaveCards(request, env) {
  const body = await request.json();
  const profile = cleanProfile(body.profile);
  if (!profile) {
    return json({ error: "Profile is required" }, 400);
  }

  const cards = Array.isArray(body.cards) ? body.cards : [];
  const folders = Array.isArray(body.folders) ? body.folders : [];
  const activity = body.activity && typeof body.activity === "object" ? body.activity : { days: {}, updatedAt: 0 };
  const polish = body.polish && typeof body.polish === "object" ? body.polish : { words: [], exercises: [], currentExercise: null };
  await env.CARDS_KV.put(
    `profile:${profile}`,
    JSON.stringify({ cards, folders, activity, polish, updatedAt: new Date().toISOString() })
  );
  return json({ ok: true });
}

async function handleImage(url, env) {
  const key = decodeURIComponent(url.pathname.replace("/images/", ""));
  if (!key || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const image = await env.CARDS_KV.get(`image:${key}`, "arrayBuffer");
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(image, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

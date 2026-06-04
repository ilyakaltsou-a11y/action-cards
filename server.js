const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 5176);
const ROOT = __dirname;
loadEnvFile();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const TEXT_MODEL = process.env.TEXT_MODEL || "gpt-5.4-mini";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1-mini";
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "medium";
const TEXT_TIMEOUT = 45 * 1000;
const DEEPSEEK_TIMEOUT = 45 * 1000;
const IMAGE_TIMEOUT = 120 * 1000;
const MAX_SONG_LINES = 24;
const IMAGE_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.IMAGE_CONCURRENCY) || 6));

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function loadEnvFile() {
  const fsSync = require("node:fs");

  for (const fileName of [".env", "evn.js", "event.js"]) {
    try {
      const envPath = path.join(ROOT, fileName);
      const envText = fsSync.readFileSync(envPath, "utf8");
    for (const rawLine of envText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
    } catch {
      // Local env files are optional. Environment variables still work normally.
    }
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
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

async function deepseekJson(messages) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal: timeoutSignal(DEEPSEEK_TIMEOUT),
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
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

async function findSongOptions(query) {
  const result = await deepseekJson([
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
    {
      role: "user",
      content: JSON.stringify({ query }),
    },
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

async function createPhrase(word, existingPhrases = [], imagePreference = "") {
  const randomSeed = Math.random().toString(36).slice(2);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: timeoutSignal(TEXT_TIMEOUT),
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
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
            randomSeed,
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
              scene: {
                type: "string",
                description: "A specific visual scene for the picture. No text in the scene.",
              },
            },
            required: ["phrase", "translation", "scene"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Phrase AI failed: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(extractResponseText(data));
}

async function createDetailsFromManualPhrase(word, phrase, imagePreference = "") {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: timeoutSignal(TEXT_TIMEOUT),
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      input: [
        {
          role: "system",
          content:
            "Return only JSON. Convert the user's English phrase into one concrete visual scene for an educational flashcard. No text should appear in the image. Also return a clear Russian translation of the English phrase. If the learner gives visual preferences, include them only when they make the scene clearer and still match the phrase.",
        },
        {
          role: "user",
          content: JSON.stringify({ word, phrase, visualPreference: imagePreference }),
        },
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
              scene: {
                type: "string",
                description: "A concrete visual scene that clearly depicts the phrase.",
              },
              translation: {
                type: "string",
                description: "A natural Russian translation of the English phrase.",
              },
            },
            required: ["scene", "translation"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Scene AI failed: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(extractResponseText(data));
}

async function createSongPhraseDrafts(songTitle) {
  if (DEEPSEEK_API_KEY) {
    const result = await deepseekJson([
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: timeoutSignal(TEXT_TIMEOUT),
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
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
        { role: "user", content: JSON.stringify({ songTitle, randomSeed: Math.random().toString(36).slice(2) }) },
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
    }),
  });

  if (!response.ok) throw new Error(`Song AI failed: ${response.status}`);
  const data = await response.json();
  return JSON.parse(extractResponseText(data)).cards || [];
}

async function createSongLineDrafts(songTitle, lines = [], existingPhrases = [], existingWords = []) {
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: timeoutSignal(TEXT_TIMEOUT),
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
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
        {
          role: "user",
          content: JSON.stringify({ songTitle, lines: cleanLines, maxCards: cleanLines.length, avoidWords }),
        },
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
    }),
  });

  if (!response.ok) throw new Error(`Song lines AI failed: ${response.status}`);
  const data = await response.json();
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

async function createImage(scene, word, imagePreference = "") {
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
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size: "1024x1536",
      quality: IMAGE_QUALITY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Image AI failed: ${response.status}`);
  }

  const data = await response.json();
  const image = data.data?.[0];
  if (image?.url) return image.url;
  if (!image?.b64_json) throw new Error("Image AI returned no image");

  await fs.mkdir(path.join(ROOT, "assets", "ai"), { recursive: true });
  const fileName = `${slugify(word)}-${Date.now()}.png`;
  const relativePath = path.join("assets", "ai", fileName);
  await fs.writeFile(path.join(ROOT, relativePath), Buffer.from(image.b64_json, "base64"));
  return relativePath.replaceAll(path.sep, "/");
}

async function handleCreateSongCards(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not set" });
    return;
  }

  try {
    const body = await readJson(request);
    const songTitle = cleanTitle(body.songTitle);
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const existingPhrases = Array.isArray(body.existingPhrases) ? body.existingPhrases : [];
    const existingWords = Array.isArray(body.existingWords) ? body.existingWords : [];
    if (!songTitle && !lines.length) {
      sendJson(response, 400, { error: "Song title is required" });
      return;
    }

    const phraseDrafts = lines.length ? await createSongLineDrafts(songTitle, lines, existingPhrases, existingWords) : await createSongPhraseDrafts(songTitle);
    const cards = await mapWithConcurrency(phraseDrafts, IMAGE_CONCURRENCY, async (draft) => {
      const word = cleanWord(draft.word) || slugify(draft.phrase).split("-")[0] || "song";
      const imageContext = lines.length
        ? `Song study from user-provided lines: ${songTitle || "untitled song"}. Vertical phone-first image. Do not include text.`
        : `Original flashcard inspired by title: ${songTitle}. Do not include text.`;
      const imageUrl = await createImage(draft.scene, word, imageContext);
      return { ...draft, word, imageUrl, imagePreference: songTitle };
    });
    sendJson(response, 200, { cards });
  } catch (error) {
    const message = error.name === "TimeoutError" || error.name === "AbortError" ? "AI timeout" : error.message;
    sendJson(response, 500, { error: message });
  }
}

async function handleCreateCard(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not set" });
    return;
  }

  try {
    const body = await readJson(request);
    const word = cleanWord(body.word);
    if (!word) {
      sendJson(response, 400, { error: "Word is required" });
      return;
    }

    const manualPhrase = String(body.phrase || "").trim().replace(/\s+/g, " ");
    const imagePreference = cleanPreference(body.imagePreference);
    const phraseDraft = manualPhrase
      ? { phrase: manualPhrase, ...(await createDetailsFromManualPhrase(word, manualPhrase, imagePreference)) }
      : await createPhrase(word, Array.isArray(body.existingPhrases) ? body.existingPhrases : [], imagePreference);
    const imageUrl = await createImage(phraseDraft.scene, word, imagePreference);
    sendJson(response, 200, {
      word,
      phrase: phraseDraft.phrase,
      translation: phraseDraft.translation,
      scene: phraseDraft.scene,
      imagePreference,
      imageUrl,
    });
  } catch (error) {
    const message = error.name === "TimeoutError" || error.name === "AbortError" ? "AI timeout" : error.message;
    sendJson(response, 500, { error: message });
  }
}

async function handleSongOptions(request, response) {
  if (!DEEPSEEK_API_KEY) {
    sendJson(response, 503, { error: "DEEPSEEK_API_KEY is not set" });
    return;
  }

  try {
    const body = await readJson(request);
    const query = String(body.query || "").trim().replace(/\s+/g, " ").slice(0, 240);
    if (!query) {
      sendJson(response, 400, { error: "Song query is required" });
      return;
    }

    const candidates = await findSongOptions(query);
    sendJson(response, 200, { candidates });
  } catch (error) {
    const message = error.name === "TimeoutError" || error.name === "AbortError" ? "DeepSeek timeout" : error.message;
    sendJson(response, 500, { error: message });
  }
}

function profilePath(profileId) {
  const cleanProfileId = cleanWord(profileId).replace(/[^a-z0-9-]/g, "").slice(0, 32);
  if (!cleanProfileId) return null;
  return path.join(ROOT, "data", "profiles", `${cleanProfileId}.json`);
}

async function handleGetCards(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const filePath = profilePath(url.searchParams.get("profile"));
  if (!filePath) {
    sendJson(response, 400, { error: "Profile is required" });
    return;
  }

  try {
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    sendJson(response, 200, {
      cards: Array.isArray(data.cards) ? data.cards : [],
      folders: Array.isArray(data.folders) ? data.folders : [],
      activity: data.activity && typeof data.activity === "object" ? data.activity : { days: {}, updatedAt: 0 },
    });
  } catch {
    sendJson(response, 200, { cards: [], folders: [], activity: { days: {}, updatedAt: 0 } });
  }
}

async function handleSaveCards(request, response) {
  const body = await readJson(request);
  const filePath = profilePath(body.profile);
  if (!filePath) {
    sendJson(response, 400, { error: "Profile is required" });
    return;
  }

  const cards = Array.isArray(body.cards) ? body.cards : [];
  const folders = Array.isArray(body.folders) ? body.folders : [];
  const activity = body.activity && typeof body.activity === "object" ? body.activity : { days: {}, updatedAt: 0 };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ cards, folders, activity, updatedAt: new Date().toISOString() }, null, 2));
  sendJson(response, 200, { ok: true });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const rawPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(ROOT, rawPath));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    if (request.method !== "HEAD") response.end(data);
    else response.end();
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/status") {
    sendJson(response, 200, {
      aiReady: Boolean(OPENAI_API_KEY),
      deepSeekReady: Boolean(DEEPSEEK_API_KEY),
      textModel: TEXT_MODEL,
      deepSeekModel: DEEPSEEK_MODEL,
      imageModel: IMAGE_MODEL,
      imageQuality: IMAGE_QUALITY,
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/create-card") {
    handleCreateCard(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/create-song-cards") {
    handleCreateSongCards(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/song-options") {
    handleSongOptions(request, response);
    return;
  }

  if (request.method === "GET" && request.url.startsWith("/api/cards")) {
    handleGetCards(request, response);
    return;
  }

  if (request.method === "PUT" && request.url === "/api/cards") {
    handleSaveCards(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, "::", () => {
  console.log(`Cards app is running at http://127.0.0.1:${PORT}/`);
  console.log(OPENAI_API_KEY ? "AI is connected." : "AI is not connected: set OPENAI_API_KEY.");
});

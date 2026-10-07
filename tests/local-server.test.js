const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { once } = require("node:events");
const { test } = require("node:test");
const { createLocalServer } = require("../server.js");
const { createFileStorage } = require("../src/local/storage.cjs");
const { loadEnvironment } = require("../src/local/env.cjs");

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "action-cards-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "public/assets"), { recursive: true });
  await fs.mkdir(path.join(root, "assets/ai"), { recursive: true });
  await fs.writeFile(path.join(root, "public/index.html"), "<h1>Cards</h1>");
  await fs.writeFile(path.join(root, "public/app.js"), "console.log('public app');");
  await fs.writeFile(path.join(root, ".env"), "DEEPSEEK_API_KEY=local-test-only\n");
  await fs.writeFile(path.join(root, "server.js"), "private source");
  const server = await createLocalServer({ root, env: {}, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  // Keep real HTTP available when an individual test mocks outgoing AI requests.
  const request = globalThis.fetch.bind(globalThis);
  return { root, server, base, fetch: (url, init) => request(base + url, init) };
}

function jsonBody(body, method = "POST") {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

test("local HTTP serves only public assets and retains legacy generated images", async (t) => {
  const app = await fixture(t);
  await fs.writeFile(path.join(app.root, "assets/ai/old.png"), Buffer.from([1, 2, 3]));
  await fs.writeFile(path.join(app.root, "assets/ai/private.json"), "private metadata");
  assert.equal(await (await app.fetch("/")).text(), "<h1>Cards</h1>");
  const script = await app.fetch("/app.js?v=65");
  assert.equal(script.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.equal(script.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await app.fetch("/app.js", { method: "HEAD" })).headers.get("content-length"), String(Buffer.byteLength(await script.text())));
  assert.deepEqual(Buffer.from(await (await app.fetch("/assets/ai/old.png")).arrayBuffer()), Buffer.from([1, 2, 3]));
  for (const route of ["/.env", "/server.js", "/src/worker.js", "/data/profiles/test.json", "/assets/ai/private.json", "/..%2f.env", "/assets/ai/%2e%2e%2f.env", "/%5c.env"]) {
    assert.equal((await app.fetch(route)).status, 404, route);
  }
  assert.equal((await app.fetch("/%E0%A4%A")).status, 400);
  assert.equal((await app.fetch("/", { method: "POST" })).status, 405);
  assert.equal((await app.fetch("/api/missing")).status, 404);
});

test("public symlinks cannot expose private files or files outside the asset directory", async (t) => {
  const app = await fixture(t);
  await fs.symlink(path.join(app.root, ".env"), path.join(app.root, "public/leak.txt"));
  await fs.symlink(path.join(app.root, ".env"), path.join(app.root, "assets/ai/leak.png"));
  for (const route of ["/leak.txt", "/assets/ai/leak.png"]) assert.equal((await app.fetch(route)).status, 404);
});

test("local profiles round-trip through the shared API without losing digits, order or trainer data", async (t) => {
  const app = await fixture(t);
  const profile = "deck-123";
  const saved = {
    profile,
    cards: [{ id: "second" }, { id: "first" }],
    folders: ["Songs / Test"], starterPacks: ["basic-actions"],
    studySettings: { mode: "russian", updatedAt: 123 },
    activity: { days: { "2026-10-07": 5 }, updatedAt: 123 },
    englishTrainer: { words: [{ word: "pick up" }], exercises: [], currentExercise: null },
    polish: { words: [{ word: "dom" }], exercises: [], currentExercise: null },
  };
  assert.equal((await app.fetch("/api/cards", jsonBody(saved, "PUT"))).status, 200);
  const result = await (await app.fetch(`/api/cards?profile=${profile}`)).json();
  const { profile: ignored, ...expected } = saved;
  assert.deepEqual(result, expected);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(app.root, "data/profiles/deck-123.json"))).cards, saved.cards);
  assert.deepEqual((await (await app.fetch("/api/cards?profile=deck-456")).json()).cards, []);
  assert.equal((await app.fetch("/api/cards")).status, 400);
});

test("older digit-stripped profile files remain readable and future saves use the correct name", async (t) => {
  const app = await fixture(t);
  const dir = path.join(app.root, "data/profiles");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "deck-old.json"), JSON.stringify({ cards: [{ id: "legacy" }] }));
  assert.equal((await (await app.fetch("/api/cards?profile=deck-old123")).json()).cards[0].id, "legacy");
  await app.fetch("/api/cards", jsonBody({ profile: "deck-old123", cards: [{ id: "new" }] }, "PUT"));
  assert.equal((await (await app.fetch("/api/cards?profile=deck-old123")).json()).cards[0].id, "new");
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, "deck-old.json"))).cards[0].id, "legacy");
});

test("invalid request bodies return JSON errors and corrupted profiles are not silently reset", async (t) => {
  const app = await fixture(t);
  for (const body of ["{bad json", "null", "[]", '"text"']) {
    const response = await app.fetch("/api/cards", { method: "PUT", body });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
  await fs.mkdir(path.join(app.root, "data/profiles"), { recursive: true });
  await fs.writeFile(path.join(app.root, "data/profiles/broken.json"), "{broken");
  const response = await app.fetch("/api/cards?profile=broken");
  assert.equal(response.status, 500);
  assert.ok((await response.json()).error);
  assert.equal(await fs.readFile(path.join(app.root, "data/profiles/broken.json"), "utf8"), "{broken");
});

test("declared and streamed oversized request bodies are rejected", async (t) => {
  const app = await fixture(t, { maxBodyBytes: 16 });
  assert.equal((await app.fetch("/api/cards", jsonBody({ profile: "too-big" }, "PUT"))).status, 413);
  const status = await new Promise((resolve, reject) => {
    const request = http.request(app.base + "/api/cards", { method: "PUT", headers: { "Transfer-Encoding": "chunked" } }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.write("0123456789");
    request.end("0123456789");
  });
  assert.equal(status, 413);
});

test("async AI failures are caught by the shared API instead of rejecting the HTTP handler", async (t) => {
  const app = await fixture(t, { env: { DEEPSEEK_API_KEY: "test-only" } });
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => { throw new Error("Mock provider unavailable"); };
  const response = await app.fetch("/api/polish/suggest-words", jsonBody({ existingWords: [], count: 10 }));
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /Mock provider unavailable/);
});

test("card generation uses the shared API, saves image bytes and exposes both image routes", async (t) => {
  const app = await fixture(t, { env: { OPENAI_API_KEY: "test-only" } });
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  const bytes = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url === "https://api.openai.com/v1/responses") {
      return Response.json({ output_text: JSON.stringify({ translation: "Подними телефон.", scene: "A hand lifting a phone." }) });
    }
    assert.equal(url, "https://api.openai.com/v1/images/generations");
    return Response.json({ data: [{ b64_json: bytes.toString("base64") }] });
  };
  const response = await app.fetch("/api/create-card", jsonBody({ word: "pick up", phrase: "Pick up the phone." }));
  assert.equal(response.status, 200);
  const card = await response.json();
  assert.equal(card.translation, "Подними телефон.");
  assert.match(card.imageUrl, /^\/images\/pick-up-.*\.png$/);
  assert.equal(calls[1].body.size, "1024x1536");
  for (const route of [card.imageUrl, card.imageUrl.replace("/images/", "/assets/ai/")]) {
    const image = await app.fetch(route);
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
  }
});

test("English and Polish training both use the shared handlers over local HTTP", async (t) => {
  const app = await fixture(t, { env: { DEEPSEEK_API_KEY: "test-only", DEEPSEEK_MODEL: "test-model" } });
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    const body = JSON.parse(options.body);
    calls.push(body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ exercise: {
      promptRu: "У меня есть дом.", expectedEn: "I have a home.", expectedPl: "Mam dom.", usedWords: ["dom", "have"]
    } }) } }] });
  };
  for (const [route, words] of [
    ["/api/english/sentence-trainer/create-exercise", ["have", "home", "read"]],
    ["/api/polish/create-exercise", ["mieć", "dom", "czytać"]],
  ]) {
    const response = await app.fetch(route, jsonBody({ words: words.map((word) => ({ word })), count: 10, mode: "hard", focusWords: [words[0]] }));
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    assert.ok((await response.json()).exercise.promptRu);
  }
  assert.equal(calls.length, 3); // Polish also audits the generated exercise.
  for (const call of calls) {
    assert.equal(call.model, "test-model");
    assert.equal(JSON.parse(call.messages.at(-1).content).mode, "hard");
  }
});

test("file storage serializes writes, preserves binary data and rejects unsafe keys", async (t) => {
  const app = await fixture(t);
  const storage = createFileStorage(app.root);
  await Promise.all(Array.from({ length: 15 }, (_, index) => storage.put("profile:ordered", JSON.stringify({ index }))));
  assert.deepEqual(await storage.get("profile:ordered", "json"), { index: 14 });
  const bytes = Uint8Array.from([0, 1, 255]);
  await storage.put("image:test.png", bytes.buffer);
  assert.deepEqual(new Uint8Array(await storage.get("image:test.png", "arrayBuffer")), bytes);
  assert.equal(await storage.get("image:missing.png", "arrayBuffer"), null);
  assert.deepEqual(await fs.readdir(path.join(app.root, "data/profiles")), ["ordered.json"]);
  for (const key of ["profile:../outside", "image:../../.env", "unknown:key"]) {
    await assert.rejects(storage.put(key, "test"), /Invalid storage key/);
    await assert.rejects(storage.get(key), /Invalid storage key/);
  }
});

test("local environment precedence is preserved and PORT is read before startup", async (t) => {
  const app = await fixture(t);
  await fs.writeFile(path.join(app.root, ".env"), "PORT=5188\nTEXT_MODEL=from-env\n");
  await fs.writeFile(path.join(app.root, "evn.js"), "TEXT_MODEL=from-legacy\nIMAGE_CONCURRENCY=3\n");
  await fs.writeFile(path.join(app.root, "event.js"), "DEEPSEEK_MODEL='test-model'\n");
  const initial = { TEXT_MODEL: "from-process" };
  const env = loadEnvironment(app.root, initial);
  assert.equal(env.PORT, "5188");
  assert.equal(env.TEXT_MODEL, "from-process");
  assert.equal(env.IMAGE_CONCURRENCY, "3");
  assert.equal(env.DEEPSEEK_MODEL, "test-model");
  assert.deepEqual(initial, { TEXT_MODEL: "from-process" });
});

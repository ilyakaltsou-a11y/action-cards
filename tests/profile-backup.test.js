const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

function backupModule() {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync(path.join(root, "public/modules/profile-backup.js"), "utf8"), sandbox);
  return sandbox.ProfileBackup;
}
const sample = () => ({ cards: [{ id: "one", phrase: "Hello!", translation: "Привет!", attempts: 8, imageUrl: "/images/private.png" }],
  folders: ["Personal"], starterPacks: ["basic-actions-v1"], studySettings: { mode: "russian" }, activity: { days: { "2026-11-01": 7 } },
  englishTrainer: { words: [{ word: "hello", translation: "привет" }] }, polish: { words: [{ word: "dom", translation: "дом" }] } });

test("backup format round-trips all profile data but never unrelated properties or credentials", () => {
  const backup = backupModule();
  const data = sample();
  const copy = backup.create("deck-private", { ...data, OPENAI_API_KEY: "secret", profileId: "other", aiReady: true });
  assert.deepEqual(JSON.parse(JSON.stringify(backup.parse(JSON.stringify(copy)).data)), data);
  assert.equal(copy.data.OPENAI_API_KEY, undefined);
  assert.throws(() => backup.parse("not json"), /прочитать/);
  assert.throws(() => backup.parse(JSON.stringify({ ...copy, version: 99 })), /не резервная/);
  assert.throws(() => backup.parse(JSON.stringify({ ...copy, data: { ...data, cards: [{}] } })), /не резервная/);
  assert.throws(() => backup.parse(JSON.stringify({ ...copy, data: { ...data, polish: { words: "broken" } } })), /словарь/);
  assert.throws(() => backup.parse(JSON.stringify({ ...copy, data: { ...data, polish: { words: [null] } } })), /словарь/);
  copy.data.cards[0].imageUrl = "javascript:alert(1)";
  assert.throws(() => backup.parse(JSON.stringify(copy)), /не резервная/);
});

test("atomic local snapshots and bounded histories are isolated by profile and survive secondary write failure", () => {
  const backup = backupModule();
  const map = new Map();
  const storage = { getItem: (key) => map.get(key), setItem: (key, value) => { map.set(key, value); } };
  for (let i = 0; i < 12; i++) {
    const copy = backup.create("a", sample(), Date.now() + i);
    backup.checkpoint(storage, "a", copy, true);
    backup.write(storage, "a", copy);
  }
  assert.equal(backup.history(storage, "a").length, 7);
  assert.equal(backup.history(storage, "b").length, 0);
  assert.equal(backup.read(storage, "a").data.cards[0].attempts, 8);
  storage.setItem = (key, value) => { if (key.includes(":backups:")) throw new Error("Quota exceeded"); map.set(key, value); };
  backup.write(storage, "a", backup.create("a", sample()));
  assert.equal(backup.read(storage, "a").data.polish.words[0].word, "dom");
  map.set("action-cards:snapshot:v1:a", "corrupt");
  assert.equal(backup.read(storage, "a"), null);
  assert.ok(backup.history(storage, "a").length);
});

test("portable files embed private generated images once and abort instead of silently losing images", async () => {
  const backup = backupModule();
  const data = sample(); data.cards.push({ ...data.cards[0], id: "two" });
  data.cards.push({ id: "starter", phrase: "Starter", imageUrl: "assets/basic.jpg" });
  let calls = 0;
  const copy = await backup.portable(backup.create("p", data), async () => { calls++; return { ok: true, blob: async () => ({ type: "image/png" }) }; }, async () => "data:image/png;base64,YQ==");
  assert.equal(calls, 1);
  assert.equal(copy.data.cards[0].imageUrl, "data:image/png;base64,YQ==");
  assert.equal(copy.data.cards[1].imageUrl, copy.data.cards[0].imageUrl);
  assert.equal(copy.data.cards[2].imageUrl, "assets/basic.jpg");
  assert.equal(data.cards[0].imageUrl, "/images/private.png");
  await assert.rejects(backup.portable(backup.create("p", data), async () => ({ ok: false }), async () => ""), /картинку/);
});

test("local history yields space to the live snapshot when storage fills up", () => {
  const backup = backupModule();
  const map = new Map();
  let enforceQuota = false;
  const storage = { getItem: (key) => map.get(key), setItem: (key, value) => {
    const count = JSON.parse(map.get("action-cards:backups:v1:p") || "[]").length;
    if (enforceQuota && key.includes(":snapshot:") && count > 2) throw new Error("Quota exceeded");
    map.set(key, value);
  } };
  for (let i = 0; i < 7; i++) backup.checkpoint(storage, "p", backup.create("p", sample(), Date.now() + i), true);
  enforceQuota = true;
  backup.write(storage, "p", backup.create("p", sample()));
  assert.equal(backup.read(storage, "p").data.cards[0].id, "one");
  assert.equal(backup.history(storage, "p").length, 2);
});

function api() {
  const store = new Map();
  let now = Date.UTC(2026, 10, 1, 12);
  let failBackup = false;
  const sandbox = { URL, Request, Response, Buffer, console, Date: class extends Date { static now() { return now; } constructor(...args) { super(...(args.length ? args : [now])); } } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "public/modules/card-import.js"), "utf8"), sandbox);
  const source = fs.readFileSync(path.join(root, "src/worker.js"), "utf8").replace('import "../public/modules/card-import.js";', "").replace("export default {", "const worker = {");
  vm.runInContext(source + "\nglobalThis.worker = worker;", sandbox);
  const env = { CARDS_KV: { get: async (key) => store.has(key) ? JSON.parse(store.get(key)) : null,
    put: async (key, value) => { if (failBackup && key.startsWith("backup:")) throw new Error("Backup storage unavailable"); store.set(key, value); } } };
  return { store, nextDay: () => { now += 86400000; }, failBackup: () => { failBackup = true; },
    call: (route, body) => sandbox.worker.fetch(new Request(`https://cards.example${route}`, body ? { method: "PUT", body: JSON.stringify(body) } : {}), env) };
}

test("server keeps one pre-change backup per day, rotates seven slots and never returns another profile", async () => {
  const app = api();
  await app.call("/api/cards", { profile: "private-a", ...sample() });
  assert.equal((await (await app.call("/api/backups?profile=private-a")).json()).backups.length, 0);
  await app.call("/api/cards", { profile: "private-a", ...sample(), cards: [] });
  const list = await (await app.call("/api/backups?profile=private-a")).json();
  assert.equal(list.backups[0].count, 1);
  const copy = await (await app.call(`/api/backups?profile=private-a&date=${list.backups[0].date}`)).json();
  assert.equal(copy.data.cards[0].attempts, 8);
  assert.equal(copy.data.englishTrainer.words[0].word, "hello");
  await app.call("/api/cards", { profile: "private-a", ...sample(), cards: [] });
  assert.equal((await (await app.call(`/api/backups?profile=private-a&date=${list.backups[0].date}`)).json()).data.cards.length, 1);
  assert.equal((await (await app.call("/api/backups?profile=private-b")).json()).backups.length, 0);
  assert.equal((await app.call(`/api/backups?profile=private-b&date=${list.backups[0].date}`)).status, 404);
  for (let i = 0; i < 10; i++) { app.nextDay(); await app.call("/api/cards", { profile: "private-a", ...sample() }); }
  assert.equal([...app.store.keys()].filter((key) => key.startsWith("backup:")).length, 7);
  assert.equal((await app.call(`/api/backups?profile=private-a&date=${list.backups[0].date}`)).status, 404);
  assert.equal((await app.call("/api/backups?profile=private-a&date=garbage")).status, 400);
  assert.equal((await app.call("/api/backups")).status, 400);
});

test("a failed checkpoint or malformed save cannot overwrite the live profile", async () => {
  const app = api();
  await app.call("/api/cards", { profile: "safe", ...sample() });
  app.failBackup();
  assert.equal((await app.call("/api/cards", { profile: "safe", cards: [] })).status, 500);
  assert.equal(JSON.parse(app.store.get("profile:safe")).cards.length, 1);
  assert.equal((await app.call("/api/cards", { profile: "safe", cards: "bad" })).status, 400);
});

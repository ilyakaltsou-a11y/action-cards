const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

const file = "src/worker.js";
test(`${file}: card study mode round-trips per profile and old profiles default to pictures`, async () => {
  const saved = new Map();
  const sandbox = {
    URL, Request, Response, Buffer,
    console: { log: () => {} },
  };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(root, file), "utf8").replace("export default {", "const worker = {");
  vm.runInContext(source + "\nglobalThis.api = { handleGetCards, handleSaveCards };", sandbox);
  const env = { CARDS_KV: {
    get: async (key) => saved.has(key) ? JSON.parse(saved.get(key)) : null,
    put: async (key, value) => saved.set(key, value),
  } };
  async function call(profile, body) {
    const url = new URL(`http://localhost/api/cards?profile=${profile}`);
    const response = body
      ? await sandbox.api.handleSaveCards(new Request(url, { method: "PUT", body: JSON.stringify({ profile, ...body }) }), env)
      : await sandbox.api.handleGetCards(url, env);
    assert.equal(response.status, 200);
    return response.json();
  }
  assert.deepEqual((await call("deck-new")).studySettings, { mode: "picture", updatedAt: 0 });
  const studySettings = { mode: "russian", updatedAt: 12345 };
  const cards = [{ id: "saved-card", phrase: "Pick up the phone.", translation: "Подними телефон." }];
  await call("deck-russian", { studySettings, cards });
  const loaded = await call("deck-russian");
  assert.deepEqual(loaded.studySettings, studySettings);
  assert.deepEqual(loaded.cards, cards);
  assert.deepEqual((await call("deck-other")).studySettings, { mode: "picture", updatedAt: 0 });
  await call("deck-old", { cards });
  assert.deepEqual((await call("deck-old")).studySettings, { mode: "picture", updatedAt: 0 });
  await call("deck-invalid", { studySettings: { mode: "anything", updatedAt: -5, extra: "ignored" } });
  assert.deepEqual((await call("deck-invalid")).studySettings, { mode: "picture", updatedAt: 0 });
  const englishTrainer = { folderPath: "Actions", folderPaths: ["Actions", "Home"], folderUpdatedAt: 12345 };
  await call("deck-folders", { englishTrainer });
  assert.deepEqual((await call("deck-folders")).englishTrainer, englishTrainer);
  const selectionSettings = { mode: "russian", selection: { folderPaths: ["Actions", "Home"], cardIds: ["a", "b"] }, updatedAt: 12346 };
  await call("deck-selection", { studySettings: selectionSettings });
  assert.deepEqual((await call("deck-selection")).studySettings, selectionSettings);
  await call("deck-empty-selection", { studySettings: { ...selectionSettings, selection: { folderPaths: [], cardIds: [] } } });
  assert.deepEqual((await call("deck-empty-selection")).studySettings.selection, { folderPaths: [], cardIds: [] });
  await call("deck-invalid-selection", { studySettings: { selection: { folderPaths: [null, "all", "Home", "all"], cardIds: ["b", 123, "a", "a"] } } });
  assert.deepEqual((await call("deck-invalid-selection")).studySettings.selection, { folderPaths: ["all"], cardIds: ["a", "b"] });
});

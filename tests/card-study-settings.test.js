const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

for (const file of ["server.js", "src/worker.js"]) {
  test(`${file}: card study mode round-trips per profile and old profiles default to pictures`, async () => {
    const saved = new Map();
    const isWorker = file.startsWith("src/");
    const sandbox = {
      __dirname: root, process: { env: {} }, URL, Request, Response, Buffer,
      console: { log: () => {} },
      require: (name) => {
        if (name === "node:http") return { createServer: () => ({ listen: () => {} }) };
        if (name === "node:fs") return { readFileSync: () => { throw new Error("No environment files in tests"); } };
        if (name === "node:fs/promises") return {
          mkdir: async () => {},
          writeFile: async (key, value) => saved.set(key, value),
          readFile: async (key) => {
            if (!saved.has(key)) throw new Error("Missing profile");
            return saved.get(key);
          },
        };
        return require(name);
      },
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
      if (isWorker) {
        const response = body
          ? await sandbox.api.handleSaveCards(new Request(url, { method: "PUT", body: JSON.stringify({ profile, ...body }) }), env)
          : await sandbox.api.handleGetCards(url, env);
        assert.equal(response.status, 200);
        return response.json();
      }
      let result;
      const request = {
        url: url.pathname + url.search, headers: { host: url.host },
        async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ profile, ...body })); },
      };
      const response = {
        writeHead: (status) => assert.equal(status, 200),
        end: (text) => { result = JSON.parse(text); },
      };
      await (body ? sandbox.api.handleSaveCards(request, response) : sandbox.api.handleGetCards(request, response));
      return result;
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
  });
}

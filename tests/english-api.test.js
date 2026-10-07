const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

const file = "src/worker.js";
test(`${file}: English generation rotates focus and style without changing other AI temperatures`, async () => {
  const calls = [];
  const sandbox = {
    crypto: require("node:crypto").webcrypto,
    AbortSignal, URL, Response, Buffer,
    console: { log: () => {} },
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body);
      const payload = JSON.parse(body.messages.at(-1).content);
      const word = payload.focusWords?.[0] || "carry";
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ exercise: {
        promptRu: "Аккуратно подними телефон.", expectedEn: "Pick up the phone carefully.", usedWords: [word, "unknown-word"],
      } }) } }] }) };
    },
  };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(root, file), "utf8").replace("export default {", "const worker = {");
  vm.runInContext(source + "\nglobalThis.api = { createEnglishTrainerExercise, deepseekJson };", sandbox);
  const vocabulary = [
    { word: "pick up", notes: "Pick up the phone. / Подними телефон." },
    { word: "carry" }, { word: "put down" },
  ];
  const history = Array.from({ length: 30 }, (_, index) => ({ promptRu: `Задание ${index}`, expectedEn: `Exercise ${index}` }));
  const prefix = [{ DEEPSEEK_API_KEY: "test-only" }];
  const first = await sandbox.api.createEnglishTrainerExercise(...prefix, vocabulary, 5, "easy", history, ["pick up"], "request");
  await sandbox.api.createEnglishTrainerExercise(...prefix, vocabulary, 20, "hard", history, ["carry"], "short story");
  assert.deepEqual(Array.from(first.usedWords), ["pick up"]);
  const firstPayload = JSON.parse(calls[0].messages.at(-1).content);
  const secondPayload = JSON.parse(calls[1].messages.at(-1).content);
  assert.equal(firstPayload.recentExercises.length, 30);
  assert.equal(firstPayload.focusWords[0], "pick up");
  assert.equal(firstPayload.exerciseStyle, "request");
  assert.ok(firstPayload.vocabulary[0].notes.includes("Подними телефон"));
  assert.equal(secondPayload.focusWords[0], "carry");
  assert.equal(secondPayload.exerciseStyle, "short story");
  assert.equal(secondPayload.mode, "hard");
  assert.equal(secondPayload.count, 20);
  assert.ok(calls[0].messages[0].content.includes("FIRST focus word is mandatory"));
  assert.ok(calls[0].messages[0].content.includes("Never repeat"));
  assert.equal(calls[0].temperature, 0.85);
  assert.equal(calls[1].temperature, 0.85);
  await sandbox.api.deepseekJson(...prefix, [{ role: "user", content: "{}" }]);
  assert.equal(calls[2].temperature, 0.2);
  await sandbox.api.createEnglishTrainerExercise(...prefix, vocabulary, 10, "medium", history, ["pick up", "put down"], "request", {
    folderPath: "Actions",
    sourceCards: [
      { word: "pick up", phrase: "Pick up the phone.", translation: "Подними телефон." },
      { word: "put down", phrase: "Put the cup down.", translation: "Поставь чашку." },
      { word: "outside", phrase: "Do not include this card." },
    ],
  });
  const scoped = JSON.parse(calls[3].messages.at(-1).content);
  assert.equal(scoped.folderPath, "Actions");
  assert.deepEqual(scoped.folderPaths, ["Actions"]);
  assert.equal(scoped.sourceCards.length, 2);
  assert.ok(calls[3].messages[0].content.includes("Combine at least 2 focus expressions"));
  assert.ok(calls[3].messages[0].content.includes("Use ONLY the selected folder"));
  await sandbox.api.createEnglishTrainerExercise(...prefix, vocabulary, 10, "medium", history, ["carry"], "request", {
    folderPath: "Actions", folderPaths: ["Actions", "Home"], sourceCards: [{ word: "carry", phrase: "Carry the cup." }],
  });
  assert.deepEqual(JSON.parse(calls[4].messages.at(-1).content).folderPaths, ["Actions", "Home"]);
  assert.ok(calls[4].messages[0].content.includes("Mix expressions from different selected folders"));
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

const focus = ["keep upright", "let me know", "move aside", "prepare", "remind"];
const exercise = {
  promptRu: "Она держала бутылку вертикально и отодвинула чашку. Она приготовила чай и напомнила мне позвонить. Она дала мне знать, когда всё было готово.",
  expectedEn: "She kept the bottle upright and moved the cup aside. She prepared tea and reminded me to call. She let me know when it was ready.",
  hint: "Обрати внимание на формы прошедшего времени.",
  usedWords: ["kept", "moved", "prepared"],
  coverage: [
    { word: "keep upright", evidence: "kept the bottle upright" },
    { word: "let me know", evidence: "let me know" },
    { word: "move aside", evidence: "moved the cup aside" },
    { word: "prepare", evidence: "prepared" },
    { word: "remind", evidence: "reminded" },
  ],
};

function harness(reply) {
  const calls = [];
  const sandbox = {
    URL, Request, Response, AbortSignal, console, crypto: require("node:crypto").webcrypto,
    fetch: async (url, options) => {
      assert.equal(url, "https://api.deepseek.com/chat/completions");
      const body = JSON.parse(options.body); calls.push(body);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ exercise: reply(calls.length - 1, body) }) } }] });
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "public/modules/card-import.js"), "utf8"), sandbox);
  const source = fs.readFileSync(path.join(root, "src/worker.js"), "utf8").replace('import "../public/modules/card-import.js";', "").replace("export default {", "const worker = {");
  vm.runInContext(source + "\nglobalThis.worker = worker;", sandbox);
  return {
    calls,
    request: (language = "english", extra = {}, env = { DEEPSEEK_API_KEY: "test-only", DEEPSEEK_MODEL: "notes-test" }) => sandbox.worker.fetch(new Request(`https://cards.example/api/${language === "english" ? "english/sentence-trainer" : "polish"}/create-exercise`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: focus.map((word) => ({ word })), focusWords: focus, requireAllFocus: true, count: 5, mode: "easy", ...extra }),
    }), env),
  };
}

test("selected English expressions use DeepSeek, accept inflections and separated phrasal verbs, and do not trust usedWords metadata", async () => {
  const api = harness(() => exercise);
  const response = await api.request("english", { words: [...focus.map((word) => ({ word, notes: `Meaning of ${word}` })), { word: "unselected" }] });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.exercise.usedWords, focus);
  assert.equal(data.exercise.expectedEn, exercise.expectedEn);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].model, "notes-test");
  const payload = JSON.parse(api.calls[0].messages.at(-1).content);
  assert.deepEqual(payload.vocabulary.map((word) => word.word), focus);
  assert.match(api.calls[0].messages[0].content, /two or three/);
  assert.match(api.calls[0].messages[0].content, /soft length target/);
});

test("missing evidence is repaired automatically with the exact missing word and a bounded three-attempt limit", async () => {
  const api = harness((attempt) => {
    const result = structuredClone(exercise);
    if (attempt === 0) result.coverage.pop();
    if (attempt === 1) result.coverage.at(-1).evidence = "remind";
    return result;
  });
  const response = await api.request();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).exercise.usedWords, focus);
  assert.equal(api.calls.length, 3);
  for (const call of api.calls.slice(1)) {
    const repair = JSON.parse(call.messages.at(-1).content).repair;
    assert.deepEqual(repair.missingWords, ["remind"]);
    assert.equal(repair.previousExercise.expectedEn, exercise.expectedEn);
    assert.equal(call.temperature, 0.2);
  }
});

test("Polish selected words are recognised through real inflected evidence rather than base-form substring matching", async () => {
  const polish = ["być", "mieć", "dom", "czytać", "książka"];
  const forms = ["Byłem", "Miałem", "domu", "czytałem", "książkę"];
  const api = harness(() => ({ promptRu: "Я был дома. У меня было время, поэтому я читал книгу.", expectedPl: "Byłem w domu. Miałem czas, więc czytałem książkę.", coverage: polish.map((word, index) => ({ word, evidence: forms[index] })) }));
  const response = await api.request("polish", { words: polish.map((word) => ({ word })), focusWords: polish });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).exercise.usedWords, polish);
  assert.equal(api.calls.length, 1);
});

test("fabricated coverage cannot match a word inside another word or silently accept an incomplete exercise", async () => {
  const api = harness(() => ({ promptRu: "Он не готов.", expectedEn: "He is unprepared.", usedWords: ["prepare"], coverage: [{ word: "prepare", evidence: "prepared" }] }));
  const response = await api.request("english", { words: [{ word: "prepare" }], focusWords: ["prepare"] });
  assert.equal(response.status, 422);
  assert.equal(api.calls.length, 3);
  const data = await response.json();
  assert.match(data.error, /автоматического исправления/);
  assert.equal(data.exercise, undefined);
});

test("repeated exercises trigger repair even when every selected expression has coverage", async () => {
  const api = harness((attempt) => attempt ? {
    ...exercise, promptRu: "Перед тем как готовить обед, она отодвинула стул и держала банку вертикально. Она напомнила мне подождать и дала знать, когда обед был готов.",
    expectedEn: "Before preparing lunch, she moved the chair aside and kept the jar upright. She reminded me to wait and let me know when lunch was ready.",
    coverage: [{ word: "keep upright", evidence: "kept the jar upright" }, { word: "let me know", evidence: "let me know" }, { word: "move aside", evidence: "moved the chair aside" }, { word: "prepare", evidence: "preparing" }, { word: "remind", evidence: "reminded" }],
  } : exercise);
  const response = await api.request("english", { recentExercises: [exercise] });
  assert.equal(response.status, 200);
  assert.equal(api.calls.length, 2);
  assert.match(JSON.parse(api.calls[1].messages.at(-1).content).repair.issues.join(" "), /new situation/);
});

test("selected-word validation never sends unknown or oversized selections to any AI provider", async () => {
  const api = harness(() => exercise);
  for (const extra of [{ focusWords: [] }, { focusWords: ["outside"] }, { words: [...focus, "sixth"].map((word) => ({ word })), focusWords: [...focus, "sixth"] }]) {
    assert.equal((await api.request("english", extra)).status, 400);
  }
  assert.equal((await api.request("polish", {}, {})).status, 503);
  assert.equal(api.calls.length, 0);
});

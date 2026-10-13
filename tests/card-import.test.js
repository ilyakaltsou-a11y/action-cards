const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const moduleSource = fs.readFileSync(path.join(root, "public/modules/card-import.js"), "utf8");
const sandbox = {};
vm.runInNewContext(moduleSource, sandbox);
const api = sandbox.CardImport;
const basic = require("../data/basic-actions.json").cards;
const cup = require("../data/cup-actions.json").cards;
const text = fs.readFileSync(path.join(__dirname, "fixtures/cup-import.txt"), "utf8");

test("all continuation starter cards reference distinct nonempty public JPEG images and translations", () => {
  const cards = require("../public/default-cards.json").cards.filter((card) => card.id.startsWith("cup-action-"));
  assert.equal(cards.length, 14);
  const hashes = new Set();
  for (const card of cards) {
    assert.ok(card.translation && card.scene && card.actionKey);
    assert.equal(card.folderPath, "Стартовые / Действия с предметами");
    const image = fs.readFileSync(path.join(root, "public", card.imageUrl));
    assert.equal(image.readUInt16BE(0), 0xffd8);
    assert.ok(image.length > 10000);
    hashes.add(require("node:crypto").createHash("sha256").update(image).digest("hex"));
  }
  assert.equal(hashes.size, 14);
});

test("cup continuation retains 14 new actions and skips 19 object-only variants", () => {
  const result = api.deduplicate(api.parse(text), basic);
  assert.equal(result.cards.length, 14);
  assert.equal(result.skipped.length, 19);
  assert.deepEqual(Array.from(result.cards, (card) => card.phrase), cup.map((card) => card.phrase));
  assert.equal(api.deduplicate([...basic, ...basic]).cards.length, 19);
  assert.equal(api.deduplicate(api.parse(text), [...basic, ...cup]).cards.length, 0);
});

test("action keys preserve important differences and leave unknown meanings to AI", () => {
  for (const [left, right] of [["Keep the cup steady.", "Keep the cup upright."], ["Bring the cup closer.", "Bring the cup to your lips."], ["Don’t spill the drink.", "Don’t drop the drink."], ["Leave the cup up.", "Leave the cup there."]]) {
    assert.notEqual(api.actionKey(left), api.actionKey(right));
  }
  assert.equal(api.actionKey("Leave the cup up."), api.actionKey("Leave the box up."));
  assert.equal(api.actionKey("I forgot to leave the cup there."), "");
  for (const phrase of ["Give up smoking.", "Carry out the task.", "Add up the numbers.", "Wash away the worries.", "Leave the room."]) {
    assert.equal(api.actionKey(phrase), "");
  }
  assert.equal(api.deduplicate([{ phrase: "I add water to the soup." }, { phrase: "I add a colleague to the call." }]).cards.length, 2);
});

test("import parsing accepts numbered lists, translations and expressions without silently truncating input", () => {
  const cards = api.parse("1. **Wash the cup.** — Помой чашку.\n2) stir — размешивать\n- Take a sip.\n\nLook at the cup.\tПосмотри на чашку.");
  assert.equal(cards.length, 4);
  assert.equal(cards[0].phrase, "Wash the cup.");
  assert.equal(cards[0].isExpression, false);
  assert.equal(cards[1].isExpression, true);
  assert.equal(cards[2].isExpression, false);
  assert.equal(cards[3].translation, "Посмотри на чашку.");
  assert.throws(() => api.parse(""), /Вставьте/);
  assert.throws(() => api.parse("Помой чашку."), /строке 1/);
  assert.throws(() => api.parse(Array(51).fill("Wash the cup.").join("\n")), /50/);
});

test("image queue is parallel but bounded, retains successes after failures and supports stopping", async () => {
  let active = 0, peak = 0;
  const saved = [], progress = [];
  const result = await api.runQueue([1, 2, 3, 4, 5, 6], {
    concurrency: 3,
    generate: async (item) => {
      active += 1; peak = Math.max(peak, active);
      await new Promise(setImmediate); active -= 1;
      if (item === 2) throw new Error("image failed");
      return item;
    },
    save: (item) => { saved.push(item); }, onProgress: (item) => progress.push(item),
  });
  assert.equal(peak, 3); assert.equal(result.completed, 5); assert.equal(result.failures.length, 1);
  assert.equal(saved.length, 5); assert.equal(progress.length, 6);
  let stopped = false;
  const cancelled = await api.runQueue([1, 2, 3], {
    concurrency: 1, shouldStop: () => stopped,
    generate: async (item) => { stopped = true; return item; }, save: () => assert.fail("Must not save after a profile switch"),
  });
  assert.equal(cancelled.completed, 0);
});

function workerFixture(reply) {
  const calls = [];
  const context = { URL, Request, Response, AbortSignal, crypto: require("node:crypto").webcrypto,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body); calls.push({ url, body });
      if (url.endsWith("/responses")) return { ok: true, json: async () => ({ output_text: JSON.stringify(reply(JSON.parse(body.input.at(-1).content))) }) };
      throw new Error("Unexpected image generation during preparation");
    },
  };
  vm.createContext(context);
  vm.runInContext(moduleSource, context);
  const workerSource = fs.readFileSync(path.join(root, "src/worker.js"), "utf8").replace('import "../public/modules/card-import.js";', "").replace("export default {", "const worker = {");
  vm.runInContext(workerSource + "\nglobalThis.worker = worker;", context);
  return { context, calls, prepare: async (body, saved = []) => {
    const response = await context.worker.fetch(new Request("http://localhost/api/import-cards/prepare", { method: "POST", body: JSON.stringify({ profile: "test", ...body }) }),
      { OPENAI_API_KEY: "test-only", CARDS_KV: { get: async () => ({ cards: saved }) } });
    return { status: response.status, data: await response.json() };
  } };
}

function drafts(payload) {
  return { cards: payload.inputs.map((card) => ({ index: card.index, word: "action", actionKey: card.actionKey || "new-action", translation: "Перевод.", scene: "Hands and a cup.", generatedPhrase: "Do not rewrite this." })) };
}

test("preparation compares the saved profile too, keeps supplied sentences and never generates duplicate images", async () => {
  const fixture = workerFixture(drafts);
  const result = await fixture.prepare({ text }, basic);
  assert.equal(result.status, 200); assert.equal(result.data.cards.length, 14); assert.equal(result.data.skipped.length, 19);
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(result.data.cards.map((card) => card.phrase), cup.map((card) => card.phrase));
  assert.deepEqual(result.data.cards.map((card) => card.translation), cup.map((card) => card.translation));
  const repeated = await fixture.prepare({ text }, [...basic, ...cup]);
  assert.equal(repeated.data.cards.length, 0); assert.equal(fixture.calls.length, 1);
});

test("preparation rejects incomplete AI output and applies semantic duplicate keys before generation", async () => {
  const partial = workerFixture(() => ({ cards: [] }));
  assert.equal((await partial.prepare({ text: "Wash the cup." })).status, 500);
  const semantic = workerFixture((payload) => ({ cards: [{ ...drafts(payload).cards[0], actionKey: "phrase:Please close the window." }] }));
  const result = await semantic.prepare({ text: "Shut the door." }, [{ phrase: "Please close the window." }]);
  assert.equal(result.data.cards.length, 0); assert.equal(result.data.skipped.length, 1);
  const expression = workerFixture((payload) => ({ cards: [{ ...drafts(payload).cards[0], generatedPhrase: "Wash the cup.", translation: "Помой чашку." }] }));
  const word = await expression.prepare({ text: "wash — мыть" });
  assert.equal(word.data.cards[0].phrase, "Wash the cup.");
  assert.equal(word.data.cards[0].translation, "Помой чашку.");
});

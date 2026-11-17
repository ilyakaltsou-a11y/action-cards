const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const api = require("../public/modules/review-queue.js");

function fixture(count = 50) {
  let time = new Date(2026, 10, 10, 12).getTime();
  let profile = "one";
  let cards = Array.from({ length: count }, (_, index) => ({ id: String(index), attempts: 0, correct: 0, nextReviewAt: 0 }));
  const create = () => api.create({ getAllCards: () => cards, getProfile: () => profile, now: () => time });
  const queue = create();
  return { queue, create, get cards() { return cards; }, reload: () => { cards = JSON.parse(JSON.stringify(cards)); }, now: () => time, advance: (ms) => { time += ms; }, profile: (value) => { profile = value; } };
}

test("unknown cards return after one other answer without flooding the queue with new cards", () => {
  const f = fixture(); const seen = [];
  for (let index = 0; index < 30; index += 1) {
    const deck = f.queue.deck(f.cards);
    assert.ok(deck.length <= 5);
    const card = deck[0]; seen.push(card.id);
    f.queue.rate(card, false);
  }
  assert.deepEqual(seen, Array.from({ length: 30 }, (_, index) => String(index % 2)));
  assert.equal(f.cards.filter((card) => card.attempts).length, 2);
  assert.equal(f.cards[0].correct, 0);
});

test("new intake mixes selected folders without expanding the five-card learning batch", () => {
  const f = fixture();
  f.cards.forEach((card, index) => { card.folderPath = index < 25 ? "Actions" : "Pronunciation"; });
  const seen = [];
  for (let index = 0; index < 10; index += 1) { const card = f.queue.deck(f.cards)[0]; seen.push(card.id); f.queue.rate(card, true); }
  assert.deepEqual(seen.slice(0, 5), ["0", "25", "1", "26", "2"]);
  assert.deepEqual(seen.slice(5), seen.slice(0, 5));
});

test("learning steps graduate on success and FSRS increases calendar intervals on later recall", () => {
  const f = fixture();
  for (let index = 0; index < 10; index += 1) f.queue.rate(f.queue.deck(f.cards)[0], true);
  assert.equal(f.queue.deck(f.cards).length, 0);
  assert.match(f.queue.pause(f.cards), /завтра/);
  assert.equal(f.cards.filter((card) => card.attempts).length, 5);
  const card = f.cards[0]; const interval = card.nextReviewAt - f.now();
  assert.ok(interval >= 86400000);
  f.advance(interval);
  f.queue.rate(f.queue.deck([card])[0], true);
  assert.ok(card.nextReviewAt - f.now() > interval);
  assert.equal(card.review.memory.state, 2);
});

test("a forgotten review returns to learning rather than keeping its long interval", () => {
  const f = fixture(1); const card = f.cards[0];
  f.queue.rate(card, true); f.advance(600000); f.queue.rate(card, true);
  f.advance(card.nextReviewAt - f.now()); f.queue.rate(card, false);
  assert.equal(card.review.memory.state, 3);
  assert.equal(card.review.remaining, 1);
  assert.ok(card.nextReviewAt - f.now() <= 600000);
  assert.equal(f.queue.deck(f.cards).length, 0);
  f.advance(600000); assert.equal(f.queue.deck(f.cards)[0].id, card.id);
});

test("old weak reviews precede new cards and their batch does not grow while they are forgotten", () => {
  const f = fixture(50);
  f.cards.slice(0, 20).forEach((card) => Object.assign(card, { attempts: 6, correct: 1, nextReviewAt: f.now() - 1000 }));
  const seen = new Set();
  for (let index = 0; index < 25; index += 1) { const card = f.queue.deck(f.cards)[0]; seen.add(card.id); f.queue.rate(card, false); }
  assert.deepEqual([...seen], ["0", "1"]);
  assert.ok([...seen].every((id) => Number(id) < 20));
  assert.equal(f.cards[0].attempts, 19);
});

test("daily cap persists after reload, applies across folders, and renews on the next local day", () => {
  const f = fixture();
  for (let index = 0; index < 10; index += 1) f.queue.rate(f.queue.deck(f.cards)[0], true);
  f.reload(); const reloaded = f.create();
  assert.equal(reloaded.deck(f.cards.slice(10)).length, 0);
  assert.match(reloaded.pause(f.cards.slice(10)), /завтра/);
  f.advance(86400000);
  assert.equal(reloaded.deck(f.cards.slice(10)).length, 5);
});

test("remaining gaps survive JSON persistence and neither deck reads nor flips consume them", () => {
  const f = fixture(5); f.queue.rate(f.queue.deck(f.cards)[0], false);
  f.reload(); const next = f.create();
  assert.equal(f.cards[0].review.remaining, 1);
  for (let index = 0; index < 20; index += 1) next.deck(f.cards);
  assert.equal(f.cards[0].review.remaining, 1);
  next.rate(next.deck(f.cards)[0], false);
  assert.equal(next.deck(f.cards)[0].id, "0");
  assert.deepEqual(api.normalize(f.cards[0].review), f.cards[0].review);
});

test("recall after a miss advances through gaps of 1, 5, 15, 30 and 60 answers, then returns to FSRS", () => {
  const f = fixture(150);
  const target = f.cards[0];
  for (const card of f.cards.slice(1)) Object.assign(card, { attempts: 1, correct: 1, nextReviewAt: f.now() });
  f.queue.rate(target, false);
  for (const gap of [1, 5, 15, 30, 60]) {
    assert.equal(target.review.remaining, gap);
    for (let index = 0; index < gap; index += 1) {
      f.advance(61000);
      const card = f.queue.deck(f.cards)[0];
      assert.notEqual(card.id, target.id);
      f.queue.rate(card, true);
    }
    assert.equal(f.queue.deck(f.cards)[0], target);
    f.queue.rate(target, true);
  }
  assert.equal(target.review.remaining, 0);
  assert.equal(target.review.step, undefined);
  assert.equal(target.review.memory.state, 2);
  assert.ok(target.nextReviewAt > f.now());
});

test("a miss resets an advanced repeat, and a small selection can use the timed fallback", () => {
  const f = fixture(1);
  const [card] = f.cards;
  f.queue.rate(card, false);
  for (const delay of [1, 5, 10]) {
    f.advance(delay * 60000);
    assert.equal(f.queue.deck(f.cards)[0], card);
    f.queue.rate(card, true);
  }
  assert.equal(card.review.remaining, 30);
  assert.deepEqual(api.normalize(card.review), card.review);
  f.advance(600000);
  f.queue.rate(f.queue.deck(f.cards)[0], false);
  assert.equal(card.review.step, 0);
  assert.equal(card.review.remaining, 1);
  assert.equal(api.normalize({ ...card.review, step: undefined, remaining: 4 }).remaining, 1);
});

test("single-card packs wait instead of immediately repeating, and the visible card stays pinned", () => {
  const f = fixture(1); const card = f.queue.deck(f.cards)[0];
  f.queue.rate(card, false);
  assert.deepEqual(f.queue.deck(f.cards), []);
  assert.match(f.queue.pause(f.cards), /через 1 мин/);
  f.advance(60000); assert.equal(f.queue.deck(f.cards)[0].id, card.id);
  f.advance(86400000); assert.equal(f.queue.deck(f.cards)[0].id, card.id);
});

test("folders, deletions, explicit empty selections and profiles cannot leak unrelated cards", () => {
  const f = fixture();
  assert.equal(f.queue.deck(f.cards.slice(20, 30))[0].id, "20");
  assert.equal(f.queue.deck(f.cards.slice(30))[0].id, "30");
  assert.deepEqual(f.queue.deck([]), []);
  const pool = f.cards.slice(20, 25); f.queue.deck(pool); pool.shift();
  assert.equal(f.queue.deck(pool)[0].id, "21");
  f.profile("two"); assert.equal(f.queue.deck(f.cards.slice(40))[0].id, "40");
});

test("a revealed card cannot change at midnight when a different review becomes due", () => {
  const f = fixture(2);
  Object.assign(f.cards[1], { attempts: 2, correct: 2, nextReviewAt: f.now() + 60000 });
  assert.equal(f.queue.deck(f.cards)[0].id, "0");
  f.advance(86400000);
  assert.equal(f.queue.deck(f.cards)[0].id, "0");
  f.queue.rate(f.cards[0], true);
  assert.equal(f.queue.deck(f.cards)[0].id, "1");
});

test("future legacy reviews are respected and invalid memory falls back without discarding card totals", () => {
  const f = fixture(2);
  Object.assign(f.cards[0], { attempts: 9, correct: 8, nextReviewAt: f.now() + 86400000 });
  assert.equal(f.queue.deck(f.cards)[0].id, "1");
  assert.equal(api.normalize({ version: 1, memory: { due: "broken" } }), null);
  f.queue.rate(f.cards[0], false);
  assert.equal(f.cards[0].attempts, 10); assert.equal(f.cards[0].correct, 8);
  assert.ok(api.normalize(f.cards[0].review));
});

test("offline vendor bytes and license match the pinned installed FSRS package", () => {
  const source = path.dirname(require.resolve("ts-fsrs"));
  assert.deepEqual(fs.readFileSync(path.join(__dirname, "../public/modules/vendor/ts-fsrs.js")), fs.readFileSync(path.join(source, "index.umd.js")));
  assert.deepEqual(fs.readFileSync(path.join(__dirname, "../public/modules/vendor/ts-fsrs.LICENSE.txt")), fs.readFileSync(path.join(source, "../LICENSE")));
});

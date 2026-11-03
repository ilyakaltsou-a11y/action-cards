const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const source = require("../data/kitchen-dialogues.json");

test("kitchen pack contains all 23 complete dialogues and 48 translated turns", () => {
  assert.equal(source.cards.length, 23);
  assert.equal(source.cards.reduce((count, card) => count + card.phrase.split("\n").length, 0), 48);
  const phrases = new Set();
  for (const card of source.cards) {
    assert.ok(card.word && card.scene && card.translation);
    assert.equal(card.phrase.split("\n").length, card.translation.split("\n").length);
    assert.ok(card.phrase.split("\n").every((line) => line.trim()));
    phrases.add(card.phrase.toLowerCase().replace(/\s+/g, " ").trim());
  }
  assert.equal(phrases.size, 23);
  assert.equal(source.cards[0].phrase, "Hi! How are you?\nHi! I’m good. How about you?\nI’m good too.");
  assert.ok(source.cards[18].phrase.includes("Have you checked the fridge?"));
  assert.equal(source.cards[22].phrase, "Could you hand me your cup?\nHere you go. Thanks for the coffee.");
});

test("every dialogue ships with a distinct portrait photo, translation and stable starter ID", () => {
  const defaults = JSON.parse(fs.readFileSync(path.join(root, "public/default-cards.json")));
  const cards = defaults.cards.filter((card) => card.id.startsWith("kitchen-dialogue-"));
  assert.equal(cards.length, 23);
  const hashes = new Set();
  cards.forEach((card, index) => {
    assert.equal(card.id, `kitchen-dialogue-${String(index + 1).padStart(3, "0")}`);
    assert.equal(card.phrase, source.cards[index].phrase);
    assert.equal(card.translation, source.cards[index].translation);
    assert.equal(card.folderPath, source.folderPath);
    assert.equal(card.attempts, 0);
    const photo = fs.readFileSync(path.join(root, "public", card.imageUrl));
    assert.equal(photo.readUInt16BE(0), 0xffd8);
    assert.ok(photo.length > 10000);
    hashes.add(crypto.createHash("sha256").update(photo).digest("hex"));
  });
  assert.equal(hashes.size, 23);
});

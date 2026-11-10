const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const source = require("../data/spoken-english.json");
const defaults = require("../public/default-cards.json");

test("all 39 supplied spoken pairs have distinct standard fronts and Russian translations without images", () => {
  const cards = defaults.cards.filter((card) => card.id.startsWith("spoken-english-"));
  assert.equal(source.cards.length, 39); assert.equal(cards.length, 39);
  assert.equal(new Set(cards.map((card) => card.standardPhrase)).size, 39);
  for (const [index, card] of cards.entries()) {
    assert.equal(card.standardPhrase, source.cards[index].standardPhrase);
    assert.equal(card.phrase, source.cards[index].phrase);
    assert.match(card.translation, /[А-Яа-яЁё]/);
    assert.equal(card.imageUrl, ""); assert.equal(card.textOnly, true);
    assert.equal(card.folderPath, source.folderPath);
  }
  assert.equal(cards[16].standardPhrase, "Do you want to come? It's going to be okay.");
  assert.equal(cards[16].phrase, "Wanna come? It's gonna be okay.");
});

test("standalone and browser starter copies include identical pronunciation cards", () => {
  const root = path.resolve(__dirname, "..");
  for (const file of ["default-cards.json", "data/default-cards.json"]) assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, file))), defaults);
});

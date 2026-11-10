const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const pack = JSON.parse(fs.readFileSync(path.join(root, "data/spoken-english.json"), "utf8"));
const defaults = JSON.parse(fs.readFileSync(path.join(root, "public/default-cards.json"), "utf8"));
const cards = pack.cards.map((card, index) => ({
  ...card, id: `spoken-english-${String(index + 1).padStart(3, "0")}`,
  word: card.standardPhrase, textOnly: true, topic: "daily", folderPath: pack.folderPath,
  imageUrl: "", attempts: 0, correct: 0, level: 0, nextReviewAt: 0, lastReviewedAt: 0,
  createdAt: 1794268800000 + index, updatedAt: 0,
}));
defaults.cards = [...defaults.cards.filter((card) => !card.id.startsWith("spoken-english-")), ...cards];
for (const file of ["public/default-cards.json", "default-cards.json", "data/default-cards.json"]) {
  fs.writeFileSync(path.join(root, file), JSON.stringify(defaults, null, 2) + "\n");
}
console.log(`Added ${cards.length} text-only pronunciation cards.`);

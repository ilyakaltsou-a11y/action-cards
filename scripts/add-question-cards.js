const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pack = JSON.parse(fs.readFileSync(path.join(root, "data/basic-questions.json"), "utf8"));
const defaults = JSON.parse(fs.readFileSync(path.join(root, "public/default-cards.json"), "utf8"));

const cards = pack.cards.map((card, index) => {
  const id = `basic-question-${String(index + 1).padStart(3, "0")}`;
  return {
    ...card,
    id,
    topic: "daily",
    folderPath: pack.folderPath,
    imagePreference: "",
    textOnly: true,
    imageUrl: "",
    attempts: 0, correct: 0, level: 0, nextReviewAt: 0, lastReviewedAt: 0,
    createdAt: 1791417600000 + index, updatedAt: 0,
  };
});

defaults.cards = defaults.cards.filter((card) => !card.id.startsWith("basic-question-"));
defaults.cards.push(...cards);
for (const file of ["public/default-cards.json", "default-cards.json", "data/default-cards.json"]) {
  fs.writeFileSync(path.join(root, file), JSON.stringify(defaults, null, 2) + "\n");
}
console.log(`Added ${cards.length} text-only cards to ${pack.folderPath}.`);

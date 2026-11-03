const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = JSON.parse(await fs.readFile(path.join(root, "data/kitchen-dialogues.json"), "utf8"));
  const defaults = JSON.parse(await fs.readFile(path.join(root, "public/default-cards.json"), "utf8"));
  const old = defaults.cards.filter((card) => !card.id.startsWith("kitchen-dialogue-"));
  const seen = new Set(old.map((card) => card.phrase.toLowerCase().replace(/\s+/g, " ").trim()));
  const additions = source.cards.map((card, index) => ({
    ...card, id: `kitchen-dialogue-${String(index + 1).padStart(3, "0")}`, topic: "daily", folderPath: source.folderPath,
    imageUrl: `assets/kitchen-dialogues/kitchen-dialogue-${String(index + 1).padStart(3, "0")}.jpg`, imagePreference: "",
    attempts: 0, correct: 0, level: 0, nextReviewAt: 0, lastReviewedAt: 0, createdAt: 1793664000000 + index, updatedAt: 0,
  }));
  for (const card of additions) {
    const key = card.phrase.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) throw new Error(`Duplicate dialogue: ${card.id}`);
    seen.add(key);
    await fs.access(path.join(root, "public", card.imageUrl));
    if (card.phrase.split("\n").length !== card.translation.split("\n").length) throw new Error(`Translation mismatch: ${card.id}`);
  }
  defaults.cards = [...old, ...additions];
  for (const file of ["public/default-cards.json", "data/default-cards.json", "default-cards.json"]) {
    await fs.writeFile(path.join(root, file), JSON.stringify(defaults, null, 2) + "\n");
  }
  console.log(`Added ${additions.length} kitchen dialogues; retained ${old.length} existing cards.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

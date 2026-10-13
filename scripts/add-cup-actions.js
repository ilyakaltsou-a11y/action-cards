const fs = require("node:fs/promises");
const path = require("node:path");
require("../public/modules/card-import.js");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = JSON.parse(await fs.readFile(path.join(root, "data/cup-actions.json"), "utf8"));
  const defaults = JSON.parse(await fs.readFile(path.join(root, "public/default-cards.json"), "utf8"));
  const old = defaults.cards.filter((card) => !card.id.startsWith("cup-action-"));
  const { cards, skipped } = globalThis.CardImport.deduplicate(source.cards, old);
  if (skipped.length) throw new Error(`Starter continuation has ${skipped.length} duplicate actions`);
  const additions = cards.map((card, index) => ({
    ...card, id: `cup-action-${String(index + 1).padStart(3, "0")}`, topic: "daily", folderPath: source.folderPath,
    imageUrl: `assets/cup-actions/cup-action-${String(index + 1).padStart(3, "0")}.jpg`, imagePreference: "",
    attempts: 0, correct: 0, level: 0, nextReviewAt: 0, lastReviewedAt: 0, createdAt: 1791849600000 + index, updatedAt: 0,
  }));
  for (const card of additions) await fs.access(path.join(root, "public", card.imageUrl));
  defaults.cards = [...old, ...additions];
  for (const file of ["public/default-cards.json", "data/default-cards.json", "default-cards.json"]) {
    await fs.writeFile(path.join(root, file), JSON.stringify(defaults, null, 2) + "\n");
  }
  console.log(`Added ${additions.length} unique cup actions; retained ${old.length} existing cards.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

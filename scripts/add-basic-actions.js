const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

async function main() {
  const source = JSON.parse(await fs.readFile(path.join(root, "data/basic-actions.json"), "utf8"));
  const defaults = JSON.parse(await fs.readFile(path.join(root, "public/default-cards.json"), "utf8"));
  const savedCards = new Map(defaults.cards.map((card) => [card.id, card]));
  const imageDir = path.join(root, "public/assets/basic-actions");
  await fs.mkdir(imageDir, { recursive: true });
  const results = new Array(source.cards.length);
  let next = 0;
  const workers = await Promise.allSettled(Array.from({ length: 3 }, async () => {
    while (next < source.cards.length) {
      const index = next++;
      const card = source.cards[index];
      const id = `basic-action-${String(index + 1).padStart(3, "0")}`;
      const savedCard = savedCards.get(id);
      if (savedCard?.imageUrl === `assets/basic-actions/${id}.jpg`) {
        await fs.access(path.join(root, "public", savedCard.imageUrl));
        results[index] = { ...savedCard, ...card, folderPath: source.folderPath };
        continue;
      }
      const draftFile = path.join(imageDir, `${id}.json`);
      let draft;
      try {
        draft = JSON.parse(await fs.readFile(draftFile, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        let response;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          response = await fetch("http://127.0.0.1:5176/api/create-card", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              word: card.word,
              phrase: card.phrase,
              imagePreference: "Show this exact everyday action clearly, with visible hands and the named object. For movement, show a clear directional arrow, no letters. Portrait image, no writing.",
            }),
            signal: AbortSignal.timeout(190000),
          });
          if (response.status !== 429 && response.status !== 500) break;
          const failure = await response.clone().json();
          if (!String(failure.error || "").includes("429") || attempt === 2) break;
          await new Promise((resolve) => setTimeout(resolve, 30000));
        }
        draft = await response.json();
        if (!response.ok || !draft.imageUrl) throw new Error(`${id}: ${draft.error || response.status}`);
        await fs.writeFile(draftFile, JSON.stringify(draft));
      }
      if (!draft.imageUrl.startsWith("assets/ai/")) throw new Error(`${id}: expected a saved local image`);
      execFileSync("sips", ["-Z", "768", "-s", "format", "jpeg", "-s", "formatOptions", "65", path.join(root, draft.imageUrl), "--out", path.join(imageDir, `${id}.jpg`)], { stdio: "ignore" });
      results[index] = {
        ...card, id, topic: "daily", folderPath: source.folderPath,
        scene: draft.scene, imagePreference: "", imageUrl: `assets/basic-actions/${id}.jpg`,
        attempts: 0, correct: 0, level: 0, nextReviewAt: 0, lastReviewedAt: 0,
        createdAt: 1791158400000 + index, updatedAt: 0,
      };
      console.log(`Ready ${index + 1}/${source.cards.length}: ${card.phrase}`);
    }
  }));
  const failure = workers.find((worker) => worker.status === "rejected");
  if (failure) throw failure.reason;
  defaults.cards = defaults.cards.filter(card => !card.id.startsWith("basic-action-"));
  defaults.cards.push(...results);
  for (const file of ["public/default-cards.json", "default-cards.json", "data/default-cards.json"]) {
    await fs.writeFile(path.join(root, file), JSON.stringify(defaults, null, 2) + "\n");
  }
  await fs.mkdir(path.join(root, "assets/basic-actions"), { recursive: true });
  for (const card of results) {
    await fs.copyFile(path.join(root, "public", card.imageUrl), path.join(root, card.imageUrl));
    await fs.rm(path.join(imageDir, `${card.id}.json`), { force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

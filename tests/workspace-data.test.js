const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "public/modules/workspace.js"), "utf8"), sandbox);
const api = sandbox.MountainWorkspace;

test("workspace data merges themes independently from notes and preserves deletions and favorites", () => {
  const left = { theme: "forest", themeUpdatedAt: 20, notes: [{ id: "one", title: "Old", updatedAt: 10 }], favorites: [{ id: "card", active: true, updatedAt: 10 }] };
  const right = { theme: "unknown", themeUpdatedAt: 0, notes: [{ id: "one", title: "Deleted", updatedAt: 30, deletedAt: 30 }, { id: "two", title: "New", updatedAt: 40 }], favorites: [{ id: "card", active: false, updatedAt: 30 }] };
  const merged = api.merge(left, right);
  assert.equal(merged.theme, "forest"); assert.equal(merged.notes.length, 2);
  assert.equal(merged.notes[0].deletedAt, 30); assert.equal(merged.favorites[0].active, false);
  assert.equal(left.notes[0].title, "Old");
  assert.equal(api.normalize(null).theme, "alpine");
  assert.equal(api.normalize({ notes: [null, "bad"] }).notes.length, 0);
});

test("all nine distinct theme images are shipped and referenced in the offline shell", () => {
  const sw = fs.readFileSync(path.join(root, "public/service-worker.js"), "utf8");
  const hashes = new Set();
  for (const [id] of api.themes) {
    const bytes = fs.readFileSync(path.join(root, "public/assets/themes", id + ".jpg"));
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8); assert.ok(bytes.length > 20000);
    hashes.add(require("node:crypto").createHash("sha256").update(bytes).digest("hex"));
    assert.ok(sw.includes(`./assets/themes/${id}.jpg`));
  }
  assert.equal(hashes.size, 9);
});

test("upgrading the shell keeps per-profile downloaded image caches", async () => {
  const handlers = new Map(); const deleted = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, "public/service-worker.js"), "utf8"), {
    self: { addEventListener: (name, fn) => handlers.set(name, fn), clients: { claim: () => {} } },
    caches: { keys: async () => ["action-cards:v72", "action-cards:v73", "action-cards:v73-mountain", "action-cards:offline:v1:private-profile", "other-app"], delete: async (key) => deleted.push(key) },
  });
  let work; handlers.get("activate")({ waitUntil: (promise) => { work = promise; } }); await work;
  assert.deepEqual(deleted, ["action-cards:v72", "action-cards:v73"]);
});

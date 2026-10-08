const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { parseHTML } = require("linkedom");
const root = path.resolve(__dirname, "..");

function serviceWorker() {
  const listeners = new Map();
  const matched = [];
  let cached = [];
  const sandbox = {
    URL,
    self: { addEventListener: (type, listener) => listeners.set(type, listener), location: new URL("https://cards.example/"), skipWaiting: () => {} },
    caches: {
      open: async () => ({ addAll: async (assets) => { cached = [...assets]; } }),
      match: async (request, options) => { matched.push({ url: request.url, options }); return new Response("cached module"); },
    },
    fetch: async () => { throw new Error("Offline"); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "public/service-worker.js"), "utf8"), sandbox);
  return { listeners, matched, cached: () => cached };
}

test("offline installation includes every browser script in its declared load order", async () => {
  const sw = serviceWorker();
  let installation;
  sw.listeners.get("install")({ waitUntil: (promise) => { installation = promise; } });
  await installation;
  const { document } = parseHTML(fs.readFileSync(path.join(root, "public/index.html"), "utf8"));
  const scripts = [...document.querySelectorAll("script[src]")].map((script) => script.getAttribute("src").split("?")[0]);
  assert.equal(scripts.at(-1), "app.js");
  for (const file of scripts) {
    assert.ok(sw.cached().includes(`./${file}`), `${file} must be available offline`);
    assert.ok(fs.existsSync(path.join(root, "public", file)));
  }
});

test("versioned modules fall back to the offline cache without intercepting API requests", async () => {
  const sw = serviceWorker();
  let response;
  sw.listeners.get("fetch")({ request: new Request("https://cards.example/modules/activity.js?v=66"), respondWith: (promise) => { response = promise; } });
  assert.equal(await (await response).text(), "cached module");
  assert.equal(sw.matched[0].options.ignoreSearch, true);
  for (const route of ["/api/status", "/images/private.png"]) {
    sw.listeners.get("fetch")({ request: new Request(`https://cards.example${route}`), respondWith: () => assert.fail("Dynamic requests must not be cached") });
  }
});

test("compatibility browser copies match public sources including the new modules", () => {
  const { BROWSER_FILES } = require("../scripts/sync-browser.js");
  for (const file of [...BROWSER_FILES, "modules/activity.js", "modules/swipe.js", "modules/practice-selection.js"]) {
    assert.equal(fs.readFileSync(path.join(root, file), "utf8"), fs.readFileSync(path.join(root, "public", file), "utf8"), file);
  }
});

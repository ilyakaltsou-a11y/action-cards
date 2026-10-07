const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");

test("standalone Cloudflare build serves the canonical UI and shared API without external assets", async () => {
  const root = path.resolve(__dirname, "..");
  execFileSync(process.execPath, ["scripts/build-standalone.js"], { cwd: root });
  const source = fs.readFileSync(path.join(root, "src/worker-standalone.js"), "utf8");
  const sandbox = { URL, Request, Response, atob, Uint8Array };
  vm.createContext(sandbox);
  vm.runInContext(source.replace("export default {", "const worker = {") + "\nglobalThis.worker = worker;", sandbox);
  const worker = sandbox.worker;
  const home = await worker.fetch(new Request("https://cards.example/"), {});
  assert.equal(home.status, 200);
  assert.equal(await home.text(), fs.readFileSync(path.join(root, "public/index.html"), "utf8"));
  const icons = await worker.fetch(new Request("https://cards.example/assets/icons.svg"), {});
  assert.equal(icons.status, 200);
  assert.equal(icons.headers.get("content-type"), "image/svg+xml");
  const status = await worker.fetch(new Request("https://cards.example/api/status"), {});
  assert.equal((await status.json()).aiReady, false);
  const invalid = await worker.fetch(new Request("https://cards.example/api/cards", { method: "PUT", body: "null" }), {});
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).error);
});

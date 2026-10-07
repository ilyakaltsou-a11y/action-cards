const fs = require("node:fs");
const path = require("node:path");

const BROWSER_FILES = ["app.js", "index.html", "styles.css", "service-worker.js"];

function copyIfChanged(source, target) {
  const content = fs.readFileSync(source);
  try {
    if (content.equals(fs.readFileSync(target))) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function copyModules(source, target) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyModules(from, to);
    else if (entry.isFile()) copyIfChanged(from, to);
  }
}

function syncBrowserCopies(root = path.resolve(__dirname, "..")) {
  const publicDir = path.join(root, "public");
  for (const file of BROWSER_FILES) copyIfChanged(path.join(publicDir, file), path.join(root, file));
  const modules = path.join(publicDir, "modules");
  if (fs.existsSync(modules)) copyModules(modules, path.join(root, "modules"));
}

if (require.main === module) syncBrowserCopies();

module.exports = { syncBrowserCopies, BROWSER_FILES };

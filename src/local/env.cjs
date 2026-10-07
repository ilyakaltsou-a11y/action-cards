const fs = require("node:fs");
const path = require("node:path");

function loadEnvironment(root, initial = process.env) {
  const env = { ...initial };
  for (const fileName of [".env", "evn.js", "event.js"]) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, fileName), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !env[key]) env[key] = value;
    }
  }
  return env;
}

module.exports = { loadEnvironment };

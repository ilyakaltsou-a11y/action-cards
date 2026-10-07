const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function createFileStorage(root) {
  const pending = new Map();

  function location(key) {
    const profile = /^profile:([a-z0-9-]{1,32})$/.exec(key);
    if (profile) return path.join(root, "data", "profiles", `${profile[1]}.json`);
    const image = /^image:([a-z0-9-]+\.png)$/.exec(key);
    if (image) return path.join(root, "assets", "ai", image[1]);
    throw new Error("Invalid storage key");
  }

  async function get(key, type = "text") {
    const filePath = location(key);
    let data;
    try {
      data = await fs.readFile(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      // Older local versions removed digits from profile filenames.
      const legacyKey = key.startsWith("profile:") ? key.replace(/[0-9]/g, "") : key;
      if (legacyKey === key || legacyKey === "profile:") return null;
      try {
        data = await fs.readFile(location(legacyKey));
      } catch (legacyError) {
        if (legacyError.code === "ENOENT") return null;
        throw legacyError;
      }
    }
    if (type === "json") return JSON.parse(data.toString("utf8"));
    if (type === "arrayBuffer") return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return data.toString("utf8");
  }

  async function put(key, value) {
    const filePath = location(key);
    const previous = pending.get(key) || Promise.resolve();
    const write = previous.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, typeof value === "string" ? value : Buffer.from(value));
        await fs.rename(temporary, filePath);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    });
    pending.set(key, write);
    try {
      await write;
    } finally {
      if (pending.get(key) === write) pending.delete(key);
    }
  }

  return { get, put };
}

module.exports = { createFileStorage };

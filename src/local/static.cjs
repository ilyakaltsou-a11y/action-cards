const fs = require("node:fs/promises");
const path = require("node:path");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function createStaticAssets(root) {
  return {
    async fetch(request) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response("Invalid path", { status: 400 });
      }
      if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").some((part) => part.startsWith("."))) {
        return new Response("Not found", { status: 404 });
      }

      const legacyImage = pathname.startsWith("/assets/ai/");
      const directory = path.join(root, legacyImage ? "assets/ai" : "public");
      const relative = legacyImage ? pathname.slice("/assets/ai/".length) : pathname === "/" ? "index.html" : pathname.slice(1);
      try {
        const [base, file] = await Promise.all([
          fs.realpath(directory),
          fs.realpath(path.join(directory, relative)),
        ]);
        const contained = path.relative(base, file);
        if (!contained || contained.startsWith(`..${path.sep}`) || contained === ".." || path.isAbsolute(contained)) {
          return new Response("Not found", { status: 404 });
        }
        if (legacyImage && !/\.(png|jpe?g)$/i.test(file)) return new Response("Not found", { status: 404 });
        if (!(await fs.stat(file)).isFile()) return new Response("Not found", { status: 404 });
        const data = await fs.readFile(file);
        return new Response(request.method === "HEAD" ? null : data, {
          headers: {
            "Content-Type": MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
            "Content-Length": String(data.byteLength),
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        if (["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) return new Response("Not found", { status: 404 });
        throw error;
      }
    },
  };
}

module.exports = { createStaticAssets };

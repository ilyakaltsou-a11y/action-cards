const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { loadEnvironment } = require("./src/local/env.cjs");
const { createFileStorage } = require("./src/local/storage.cjs");
const { createStaticAssets } = require("./src/local/static.cjs");

const MAX_BODY_BYTES = 20 * 1024 * 1024;

async function readBody(request, maxBytes) {
  const length = Number(request.headers["content-length"]);
  if (length > maxBytes) throw Object.assign(new Error("Request body is too large"), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("Request body is too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function createLocalServer({ root = __dirname, env = process.env, maxBodyBytes = MAX_BODY_BYTES } = {}) {
  const { default: worker } = await import(pathToFileURL(path.join(__dirname, "src/worker.js")).href);
  const bindings = { ...env, CARDS_KV: createFileStorage(root), ASSETS: createStaticAssets(root) };

  return http.createServer(async (incoming, outgoing) => {
    try {
      const method = incoming.method;
      const url = new URL(incoming.url, "http://localhost");
      const body = method === "GET" || method === "HEAD" ? undefined : await readBody(incoming, maxBodyBytes);
      const request = new Request(url, { method, headers: incoming.headers, body });
      const response = await worker.fetch(request, bindings);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (method === "HEAD" || !response.body) outgoing.end();
      else await pipeline(Readable.fromWeb(response.body), outgoing);
    } catch (error) {
      if (outgoing.headersSent) {
        outgoing.destroy();
        return;
      }
      const status = error.status || 500;
      outgoing.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      outgoing.end(JSON.stringify({ error: status === 413 ? error.message : "Local server error" }));
    }
  });
}

async function start() {
  const env = loadEnvironment(__dirname);
  const port = Number(env.PORT || 5176);
  const host = env.HOST || "127.0.0.1";
  const server = await createLocalServer({ env });
  server.on("error", (error) => {
    console.error(`Cannot start local server: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Cards app is running at http://${host}:${server.address().port}/`);
    console.log(env.OPENAI_API_KEY ? "AI is connected." : "AI is not connected: set OPENAI_API_KEY.");
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createLocalServer };

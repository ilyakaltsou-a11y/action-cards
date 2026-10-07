const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
function scriptsIn(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return scriptsIn(file);
    return /\.(c?js)$/.test(entry.name) ? [file] : [];
  });
}

const files = ["server.js", "src/worker.js", ...scriptsIn("public"), ...scriptsIn("src/local"), ...scriptsIn("scripts")];
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "pipe" });
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    process.exit(1);
  }
}
console.log(`Syntax checks passed for ${files.length} source files.`);

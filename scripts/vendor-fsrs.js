const fs = require("node:fs");
const path = require("node:path");

function vendorFsrs(root = path.resolve(__dirname, "..")) {
  const source = path.dirname(require.resolve("ts-fsrs"));
  const target = path.join(root, "public/modules/vendor");
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(path.join(source, "index.umd.js"), path.join(target, "ts-fsrs.js"));
  fs.copyFileSync(path.join(source, "../LICENSE"), path.join(target, "ts-fsrs.LICENSE.txt"));
}
if (require.main === module) vendorFsrs();
module.exports = { vendorFsrs };

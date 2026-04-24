const { spawnSync } = require("node:child_process");
const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

const roots = ["src", "test", "scripts", "jest.config.js"];

function collectJavaScriptFiles(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    return path.endsWith(".js") ? [path] : [];
  }

  return readdirSync(path).flatMap((entry) => collectJavaScriptFiles(join(path, entry)));
}

const files = roots.flatMap(collectJavaScriptFiles);
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);


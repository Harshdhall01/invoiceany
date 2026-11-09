// Finds every *.test.ts and runs them with tsx (works the same on Windows/macOS/Linux, any Node >= 18).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const skip = new Set(["node_modules", ".next", ".git"]);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".test.ts")) files.push(p);
  }
})(".");

const r = spawnSync("npx", ["tsx", "--test", ...files], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);

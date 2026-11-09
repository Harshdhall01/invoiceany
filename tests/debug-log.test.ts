import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auroraDebug } from "../lib/aurora/debug-log";

async function inTempDir(fn: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "dbg-"));
  const prevCwd = process.cwd();
  const prevEnv = { ...process.env };
  process.chdir(dir);
  try {
    await fn(dir);
  } finally {
    process.chdir(prevCwd);
    process.env = prevEnv;
  }
}

test("writes nothing unless PAYMENT_PROVIDER=aurora AND DEBUG_AURORA=1", async () => {
  await inTempDir(async (dir) => {
    process.env.PAYMENT_PROVIDER = "aurora";
    delete process.env.DEBUG_AURORA;
    await auroraDebug("inv1", { kind: "status" });
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.DEBUG_AURORA = "1";
    await auroraDebug("inv1", { kind: "status" });
    assert.equal(existsSync(join(dir, ".debug")), false);
  });
});

test("appends JSON lines, redacts the API key, and sanitises the file name", async () => {
  await inTempDir(async (dir) => {
    process.env.PAYMENT_PROVIDER = "aurora";
    process.env.DEBUG_AURORA = "1";
    process.env.AURORA_API_KEY = "SUPERSECRETKEY";
    await auroraDebug("../evil/inv-1", { kind: "status", response: { url: "https://x/api/status/SUPERSECRETKEY" } });
    await auroraDebug("../evil/inv-1", { kind: "status", rawStatus: "SUCCESS" });
    const files = readdirSync(join(dir, ".debug"));
    assert.deepEqual(files, ["aurora-evilinv-1.jsonl"]);
    const text = readFileSync(join(dir, ".debug", files[0]), "utf8");
    assert.equal(text.includes("SUPERSECRETKEY"), false);
    const lines = text.trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[1].rawStatus, "SUCCESS");
    assert.ok(lines[0].ts);
  });
});

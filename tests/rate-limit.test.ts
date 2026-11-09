import test from "node:test";
import assert from "node:assert/strict";
import { MinIntervalGate, SlidingWindowLimiter } from "@/lib/rate-limit";

test("sliding window: allows `limit` hits, blocks the next, frees after the window", () => {
  const l = new SlidingWindowLimiter(3, 1000);
  assert.equal(l.check("a", 0).ok, true);
  assert.equal(l.check("a", 100).ok, true);
  assert.equal(l.check("a", 200).ok, true);
  const blocked = l.check("a", 300);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterMs, 700);
  assert.equal(l.check("a", 1001).ok, true); // first hit left the window
});

test("sliding window: keys are independent; blocked hits do not extend the block", () => {
  const l = new SlidingWindowLimiter(1, 1000);
  assert.equal(l.check("a", 0).ok, true);
  assert.equal(l.check("b", 0).ok, true);
  assert.equal(l.check("a", 500).ok, false);
  assert.equal(l.check("a", 1000).ok, true);
});

test("min interval gate: one call per key per interval", () => {
  const g = new MinIntervalGate(3000);
  assert.equal(g.tryEnter("inv1", 0), true);
  assert.equal(g.tryEnter("inv1", 2999), false);
  assert.equal(g.tryEnter("inv2", 2999), true);
  assert.equal(g.tryEnter("inv1", 3000), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { keccak256Hex } from "@/lib/aurora/keccak";
import { validateRefundAddress } from "@/lib/aurora/address";

test("keccak256 matches known Ethereum vectors", () => {
  assert.equal(keccak256Hex(""), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  assert.equal(keccak256Hex("abc"), "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
});

test("EVM: valid EIP-55 checksum address passes", () => {
  assert.deepEqual(validateRefundAddress("base", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"), { ok: true, verified: true });
});

test("EVM: one wrong letter-case fails the checksum", () => {
  const r = validateRefundAddress("eth", "0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  assert.equal(r.ok, false);
  assert.match((r as { message: string }).message, /checksum/i);
});

test("EVM: all-lowercase and all-uppercase hex are accepted (no checksum to check)", () => {
  assert.equal(validateRefundAddress("arb", "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed").ok, true);
  assert.equal(validateRefundAddress("op", "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED").ok, true);
});

test("EVM: wrong length, missing 0x, non-hex, zero address and empty are rejected", () => {
  for (const bad of ["0x1234", "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "0xZZAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "0x" + "0".repeat(40), "  "]) {
    assert.equal(validateRefundAddress("base", bad).ok, false, bad);
  }
});

test("EVM: surrounding whitespace is ignored", () => {
  assert.equal(validateRefundAddress("base", "  0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed ").ok, true);
});

test("Solana addresses are validated", () => {
  assert.equal(validateRefundAddress("sol", "11111111111111111111111111111112").ok, true);
  assert.equal(validateRefundAddress("sol", "not-a-solana-address").ok, false);
});

test("unknown chain: accepted but flagged as unverified", () => {
  const r = validateRefundAddress("btc", "bc1qexample");
  assert.equal(r.ok, true);
  assert.equal((r as { verified: boolean }).verified, false);
});

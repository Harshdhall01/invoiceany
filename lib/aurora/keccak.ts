// Minimal Keccak-256 (the Ethereum variant, NOT NIST SHA3) so we can verify EIP-55 checksums
// without adding a dependency. Verified against known vectors in tests.
const MASK = (BigInt(1) << BigInt(64)) - BigInt(1);
const RC = [
  BigInt("0x0000000000000001"), BigInt("0x0000000000008082"), BigInt("0x800000000000808a"), BigInt("0x8000000080008000"),
  BigInt("0x000000000000808b"), BigInt("0x0000000080000001"), BigInt("0x8000000080008081"), BigInt("0x8000000000008009"),
  BigInt("0x000000000000008a"), BigInt("0x0000000000000088"), BigInt("0x0000000080008009"), BigInt("0x000000008000000a"),
  BigInt("0x000000008000808b"), BigInt("0x800000000000008b"), BigInt("0x8000000000008089"), BigInt("0x8000000000008003"),
  BigInt("0x8000000000008002"), BigInt("0x8000000000000080"), BigInt("0x000000000000800a"), BigInt("0x800000008000000a"),
  BigInt("0x8000000080008081"), BigInt("0x8000000000008080"), BigInt("0x0000000080000001"), BigInt("0x8000000080008008"),
];
const ROT = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
];
const rotl = (x: bigint, n: number) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK);

function keccakF(s: bigint[]) {
  for (let round = 0; round < 24; round++) {
    const c = [0, 1, 2, 3, 4].map((x) => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) s[x + 5 * y] ^= d;
    }
    const b = new Array<bigint>(25).fill(BigInt(0));
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x][y]);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) s[x + 5 * y] = b[x + 5 * y] ^ (~b[((x + 1) % 5) + 5 * y] & MASK & b[((x + 2) % 5) + 5 * y]);
    s[0] ^= RC[round];
  }
}

export function keccak256Hex(input: string): string {
  const data = new TextEncoder().encode(input);
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  padded.set(data);
  padded[data.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;
  const s = new Array<bigint>(25).fill(BigInt(0));
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = BigInt(0);
      for (let j = 7; j >= 0; j--) lane = (lane << BigInt(8)) | BigInt(padded[off + i * 8 + j]);
      s[i] ^= lane;
    }
    keccakF(s);
  }
  let out = "";
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) out += Number((s[i] >> BigInt(8 * j)) & BigInt("0xff")).toString(16).padStart(2, "0");
  return out;
}

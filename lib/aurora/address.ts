// Validates the client's refund address for the chosen ORIGIN chain.
// SERVER is the authority; the client only gets the message back.
import { PublicKey } from "@solana/web3.js";
import { keccak256Hex } from "./keccak";

const EVM_CHAINS = new Set([
  "eth", "base", "arb", "op", "pol", "bsc", "avax", "gnosis", "scroll", "bera",
  "monad", "xlayer", "abs", "plasma", "hood",
]);

export type AddressCheck =
  | { ok: true; verified: boolean; note?: string } // verified=false => format could not be validated
  | { ok: false; message: string };

function isEip55Valid(addr: string): boolean {
  const body = addr.slice(2);
  const hash = keccak256Hex(body.toLowerCase());
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (!/[a-fA-F]/.test(ch)) continue;
    const shouldBeUpper = parseInt(hash[i], 16) >= 8;
    if ((ch === ch.toUpperCase()) !== shouldBeUpper) return false;
  }
  return true;
}

export function validateRefundAddress(chain: string, raw: string): AddressCheck {
  const address = raw.trim();
  if (!address) return { ok: false, message: "Enter the address where a refund should be sent." };

  if (EVM_CHAINS.has(chain)) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address))
      return { ok: false, message: "That is not a valid EVM address. It should start with 0x and be 42 characters long." };
    if (/^0x0{40}$/.test(address)) return { ok: false, message: "The zero address cannot receive a refund." };
    const body = address.slice(2);
    const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
    if (mixed && !isEip55Valid(address))
      return { ok: false, message: "This address has a typo (checksum mismatch). Copy it again from your wallet." };
    return { ok: true, verified: true };
  }

  if (chain === "sol") {
    try {
      new PublicKey(address);
      return { ok: true, verified: true };
    } catch {
      return { ok: false, message: "That is not a valid Solana address." };
    }
  }

  return {
    ok: true,
    verified: false,
    note: "We cannot verify the address format for this chain. Double-check it: refunds go there.",
  };
}

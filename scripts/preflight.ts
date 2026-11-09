/**
 * Pre-flight check before any REAL money moves. Free: only reads tokens and requests a DRY quote.
 *   npx tsx scripts/preflight.ts            (or: npm run preflight)
 *   npx tsx scripts/preflight.ts --usd 3 --origin <assetId>
 * Uses DRY_RUN_RECIPIENT (your Solana address) and DRY_RUN_REFUND_TO (YOUR OWN Base/EVM address) from .env.local.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { loadAuroraConfig } from "../lib/aurora/config";
import { AuroraApiError, AuroraClient } from "../lib/aurora/client";
import { usdToBaseUnits } from "../lib/aurora/amounts";

let fails = 0;
let warns = 0;
function report(level: "PASS" | "FAIL" | "WARN", msg: string) {
  if (level === "FAIL") fails++;
  if (level === "WARN") warns++;
  console.log(`[${level}] ${msg}`);
}
const info = (msg: string) => console.log(`       ${msg}`);
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a);

function loadEnvFile(file: string): boolean {
  let text: string;
  try {
    text = readFileSync(join(process.cwd(), file), "utf8");
  } catch {
    return false;
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
  return true;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function finish(): never {
  console.log("");
  if (fails === 0) {
    console.log(`RESULT: ready for the real test (${warns} warning${warns === 1 ? "" : "s"}). Read the warnings first.`);
  } else {
    console.log(`RESULT: ${fails} FAIL, ${warns} WARN. Fix the FAIL items before sending any real money.`);
  }
  process.exit(fails === 0 ? 0 : 1);
}

async function main() {
  console.log("InvoiceAny pre-flight (no money moves, dry quote only)\n");

  if (!loadEnvFile(".env.local")) {
    report("FAIL", `.env.local not found in ${process.cwd()}. Run this from the project root.`);
    finish();
  }

  // 1. Config
  let cfg;
  try {
    cfg = loadAuroraConfig();
    report("PASS", "AURORA_API_KEY is set (value not printed)");
    info(`base URL: ${cfg.AURORA_BASE_URL}`);
    info(`swap type: ${cfg.AURORA_SWAP_TYPE}, slippage: ${cfg.AURORA_SLIPPAGE_BPS} bps, quote deadline: ${cfg.QUOTE_DEADLINE_MINUTES} min`);
  } catch (e) {
    report("FAIL", e instanceof Error ? e.message : String(e));
    finish();
  }
  if (!cfg.AURORA_DESTINATION_ASSET_ID) {
    report("FAIL", "AURORA_DESTINATION_ASSET_ID is empty (run scripts/aurora-dry-run.ts and copy the Solana USDC assetId)");
    finish();
  }

  // 2. Provider + network values
  const provider = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  if (provider === "aurora") report("PASS", "PAYMENT_PROVIDER=aurora");
  else report("WARN", `PAYMENT_PROVIDER=${provider}. Switch to "aurora" only once this pre-flight has no FAIL.`);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  if (network === "mainnet-beta") report("PASS", "NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta");
  else
    report(
      "WARN",
      `NEXT_PUBLIC_SOLANA_NETWORK=${network}. Aurora pays out on Solana MAINNET. Fine for tests E2-E4, but set mainnet-beta before the memo receipt (Step F), and turn OFF Testnet Mode in Phantom to see your real USDC balance.`
    );

  // 3. Addresses
  const recipient = process.env.DRY_RUN_RECIPIENT;
  const refundTo = process.env.DRY_RUN_REFUND_TO;
  if (recipient && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipient)) report("PASS", `Freelancer Solana address looks valid: ${short(recipient)}`);
  else report("FAIL", "DRY_RUN_RECIPIENT is missing or is not a valid Solana address");
  if (refundTo && /^0x[0-9a-fA-F]{40}$/.test(refundTo)) {
    report("PASS", `Refund address looks valid: ${short(refundTo)}`);
    info("Check this is YOUR OWN Base address (first 6 and last 4 characters), or refunds will not come back to you.");
  } else report("FAIL", "DRY_RUN_REFUND_TO is missing or is not a valid 0x address");

  // 4. Aurora tokens
  const client = new AuroraClient(cfg);
  let tokens;
  try {
    const res = await client.getTokens();
    tokens = res.tokens;
    report("PASS", `Aurora tokens endpoint reachable: ${tokens.length} tokens (shape: ${res.shape})`);
  } catch (e) {
    report("FAIL", `Aurora tokens endpoint: ${e instanceof Error ? e.message : String(e)}`);
    finish();
  }

  const destination = tokens.find((t) => t.assetId === cfg.AURORA_DESTINATION_ASSET_ID);
  if (destination && destination.blockchain === "sol" && destination.symbol.toUpperCase() === "USDC")
    report("PASS", `Solana USDC found (decimals: ${destination.decimals})`);
  else {
    report("FAIL", "AURORA_DESTINATION_ASSET_ID is not Solana USDC in Aurora's token list");
    finish();
  }

  const originArg = arg("origin");
  const origin = originArg
    ? tokens.find((t) => t.assetId === originArg)
    : tokens.find((t) => t.blockchain === "base" && t.symbol.toUpperCase() === "USDC");
  if (origin) report("PASS", `Origin asset found: ${origin.symbol} on ${origin.blockchain}`);
  else {
    report("FAIL", "Origin asset (USDC on Base) not found in the token list");
    finish();
  }

  // 5. Dry quote
  if (!recipient || !refundTo) finish();
  const usd = Number(arg("usd") ?? "3");
  try {
    const q = await client.requestQuote({
      dry: true,
      swapType: cfg.AURORA_SWAP_TYPE,
      depositType: "ORIGIN_CHAIN",
      originAsset: origin.assetId,
      destinationAsset: destination.assetId,
      amount: usdToBaseUnits(usd, destination.decimals),
      slippageTolerance: cfg.AURORA_SLIPPAGE_BPS,
      refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + cfg.QUOTE_DEADLINE_MINUTES * 60_000).toISOString(),
    });
    const d = q.quote;
    const send = Number(d.amountInFormatted);
    const overhead = send - usd;
    report("PASS", `Dry quote works for a ${usd} USDC invoice`);
    info(`client must send: ${d.amountInFormatted} ${origin.symbol} on ${origin.blockchain}`);
    info(`minimum Aurora will accept: ${(Number(d.minAmountIn) / 10 ** origin.decimals).toFixed(6)} ${origin.symbol} (below this = underpaid)`);
    info(`overhead vs invoice: ${overhead.toFixed(6)} USDC (${((overhead / usd) * 100).toFixed(1)}%)`);
    info(`raw fees from quote: refundFee=${d.refundFee ?? "n/a"}, withdrawFee=${d.withdrawFee ?? "n/a"} (raw units)`);
    info(`estimated settlement: ~${d.timeEstimate}s; real quotes will use a ${cfg.QUOTE_DEADLINE_MINUTES}-minute deadline`);
    info(`freelancer receives: ${d.amountOutFormatted} USDC`);
  } catch (e) {
    if (e instanceof AuroraApiError) report("FAIL", `Dry quote rejected: ${e.message}`);
    else report("FAIL", `Dry quote failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  finish();
}

main().catch((e) => {
  report("FAIL", `Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
  finish();
});

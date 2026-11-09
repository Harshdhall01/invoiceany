/**
 * Aurora dry-run: loads .env.local, lists tokens, requests a DRY quote
 * (dry=true => nothing is executed, no deposit address is created).
 *
 * Usage (from the project root):
 *   npx tsx scripts/aurora-dry-run.ts --recipient <SOLANA_ADDRESS> --refund <ADDRESS_ON_ORIGIN_CHAIN> [--usd 10] [--origin <assetId>]
 *
 * --recipient  your Solana wallet (where USDC would land)
 * --refund     an address on the ORIGIN chain (an EVM address if the origin is Base/Ethereum)
 */
import { readFileSync } from "fs";
import { join } from "path";
import { loadAuroraConfig } from "../lib/aurora/config";
import { AuroraApiError, AuroraClient } from "../lib/aurora/client";
import type { AuroraToken } from "../lib/aurora/types";

function loadEnvFile(file: string) {
  let text = "";
  try {
    text = readFileSync(join(process.cwd(), file), "utf8");
  } catch {
    console.error(`Could not read ${file} in ${process.cwd()}. Run this from the project root.`);
    process.exit(1);
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

function arg(name: string, envName?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return envName ? process.env[envName] : undefined;
}

// 1 USDC = 1 USD (same assumption as the rest of the app). Avoids float math on big numbers.
function usdToBaseUnits(usd: number, decimals: number): string {
  if (decimals < 2) throw new Error("Token has fewer than 2 decimals; unsupported");
  return String(Math.round(usd * 100)) + "0".repeat(decimals - 2);
}

async function main() {
  loadEnvFile(".env.local");
  const cfg = loadAuroraConfig();
  const client = new AuroraClient(cfg);

  console.log("1) Fetching supported tokens...");
  const { tokens, shape } = await client.getTokens();
  console.log(`   OK: ${tokens.length} tokens, response shape: ${shape}`);
  console.log("   Chains:", [...new Set(tokens.map((t) => t.blockchain))].sort().join(", "));

  const usdc = tokens.filter((t) => t.symbol.toUpperCase() === "USDC");
  console.log("\n   USDC tokens (chain / assetId / decimals):");
  console.table(usdc.map((t) => ({ chain: t.blockchain, assetId: t.assetId, decimals: t.decimals })));

  // Destination: Solana USDC
  let destination: AuroraToken | undefined;
  if (cfg.AURORA_DESTINATION_ASSET_ID) {
    destination = tokens.find((t) => t.assetId === cfg.AURORA_DESTINATION_ASSET_ID);
    if (!destination) {
      console.error(`\nAURORA_DESTINATION_ASSET_ID is set but not found in the tokens list. Check the value.`);
      process.exit(1);
    }
  } else {
    const solUsdc = usdc.filter((t) => t.blockchain === "sol");
    if (solUsdc.length !== 1) {
      console.error(
        `\nExpected exactly 1 USDC token on chain "sol", found ${solUsdc.length}.\n` +
          `Pick the right assetId from the table above and set AURORA_DESTINATION_ASSET_ID in .env.local.`
      );
      process.exit(1);
    }
    destination = solUsdc[0];
  }
  console.log(`\n2) Destination (Solana USDC): ${destination.assetId}`);
  console.log(`   -> put this in .env.local as AURORA_DESTINATION_ASSET_ID=${destination.assetId}`);

  // Origin
  const originArg = arg("origin");
  const nonSol = usdc.filter((t) => t.blockchain !== "sol");
  const origin =
    (originArg && tokens.find((t) => t.assetId === originArg)) ||
    nonSol.find((t) => t.blockchain === "base") ||
    nonSol.find((t) => t.blockchain === "eth") ||
    nonSol[0];
  if (!origin) {
    console.error("No origin token found. Pass --origin <assetId> from the tokens list.");
    process.exit(1);
  }
  console.log(`3) Origin token: ${origin.symbol} on ${origin.blockchain} (${origin.assetId})${originArg ? "" : "  [auto-picked, override with --origin]"}`);

  const recipient = arg("recipient", "DRY_RUN_RECIPIENT");
  const refundTo = arg("refund", "DRY_RUN_REFUND_TO");
  if (!recipient || !refundTo) {
    console.error(
      "\nMissing --recipient and/or --refund.\n" +
        "Example:\n  npx tsx scripts/aurora-dry-run.ts --recipient <your Solana address> --refund <your address on the origin chain>"
    );
    process.exit(1);
  }

  if (cfg.AURORA_SWAP_TYPE !== "EXACT_OUTPUT") {
    console.error("The dry-run script currently supports AURORA_SWAP_TYPE=EXACT_OUTPUT only.");
    process.exit(1);
  }

  const usd = Number(arg("usd") ?? "10");
  const amount = usdToBaseUnits(usd, destination.decimals);
  const deadline = new Date(Date.now() + cfg.QUOTE_DEADLINE_MINUTES * 60_000).toISOString();

  console.log(`\n4) Requesting DRY quote: receive exactly ${usd} USDC (amount=${amount}, swapType=${cfg.AURORA_SWAP_TYPE})...`);
  const q = await client.requestQuote({
    dry: true,
    swapType: cfg.AURORA_SWAP_TYPE,
    depositType: "ORIGIN_CHAIN",
    originAsset: origin.assetId,
    destinationAsset: destination.assetId,
    amount,
    slippageTolerance: cfg.AURORA_SLIPPAGE_BPS,
    refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline,
  });

  const d = q.quote;
  console.log("\n   Parsed result:");
  console.table({
    correlationId: q.correlationId ?? null,
    "client must send (amountInFormatted)": d.amountInFormatted,
    "amountInUsd": d.amountInUsd,
    minAmountIn: d.minAmountIn,
    maxAmountIn: d.maxAmountIn ?? null,
    "freelancer gets (amountOutFormatted)": d.amountOutFormatted,
    amountOutUsd: d.amountOutUsd,
    timeEstimateSeconds: d.timeEstimate,
    depositAddress: d.depositAddress ?? "(none, expected for dry=true)",
    deadline: d.deadline ?? "(none, expected for dry=true)",
  });
  console.log("\n   Raw quote object:");
  console.log(JSON.stringify(d, null, 2));
  console.log("\nDry-run finished. Nothing was executed.");
}

main().catch((err) => {
  if (err instanceof AuroraApiError) {
    console.error(`\n${err.message}`);
    console.error("Response body:", JSON.stringify(err.body, null, 2));
  } else {
    console.error(`\n${err instanceof Error ? `${err.name}: ${err.message}` : err}`);
  }
  process.exit(1);
});

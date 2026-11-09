// SERVER-ONLY. Never import this file from a client component:
// it reads AURORA_API_KEY. (No NEXT_PUBLIC_ prefix, so Next will not
// bundle it for the browser unless a client file imports it.)
import { z } from "zod";

const schema = z.object({
  AURORA_API_KEY: z.string().min(1, "is required (create one at https://studio.aurora.dev)"),
  AURORA_BASE_URL: z.string().url().default("https://intents-api.aurora.dev"),
  AURORA_DESTINATION_ASSET_ID: z.string().min(1).optional(),
  QUOTE_DEADLINE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  AURORA_SWAP_TYPE: z.enum(["EXACT_INPUT", "EXACT_OUTPUT"]).default("EXACT_OUTPUT"),
  AURORA_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(1000).default(100),
});

export type AuroraConfig = z.infer<typeof schema>;

export class AuroraConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuroraConfigError";
  }
}

let cached: AuroraConfig | null = null;

/** Validates env vars once and fails with a readable message (never prints values). */
export function loadAuroraConfig(): AuroraConfig {
  if (cached) return cached;

  const raw: Record<string, string> = {};
  for (const key of Object.keys(schema.shape)) {
    const v = process.env[key];
    if (v !== undefined && v.trim() !== "") raw[key] = v.trim(); // empty = unset
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new AuroraConfigError(`Invalid Aurora configuration in .env.local:\n${lines.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/** For code paths that cannot work without the destination (Solana USDC) asset. */
export function requireDestinationAsset(cfg: AuroraConfig): string {
  if (!cfg.AURORA_DESTINATION_ASSET_ID) {
    throw new AuroraConfigError(
      "AURORA_DESTINATION_ASSET_ID is not set. Run the dry-run script, then paste the Solana USDC assetId into .env.local."
    );
  }
  return cfg.AURORA_DESTINATION_ASSET_ID;
}

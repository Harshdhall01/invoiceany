import type { AuroraClient } from "./client";
import type { AuroraToken } from "./types";

const TTL_MS = 10 * 60 * 1000;
const g = globalThis as unknown as { __auroraTokens?: { at: number; tokens: AuroraToken[] } };

/** Tokens list cached in memory for ~10 minutes (survives Next dev hot reloads). */
export async function getTokensCached(client: AuroraClient): Promise<AuroraToken[]> {
  const c = g.__auroraTokens;
  if (c && Date.now() - c.at < TTL_MS) return c.tokens;
  const { tokens } = await client.getTokens();
  g.__auroraTokens = { at: Date.now(), tokens };
  return tokens;
}

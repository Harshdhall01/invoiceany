// Dev-only raw-response logger. Server-side. Writes to .debug/aurora-<invoiceId>.jsonl (git-ignored).
// Only active when PAYMENT_PROVIDER=aurora AND DEBUG_AURORA=1. Never throws, never blocks a payment.
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

export function auroraDebugEnabled(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase() === "aurora" && process.env.DEBUG_AURORA === "1";
}

export async function auroraDebug(invoiceId: string, entry: Record<string, unknown>): Promise<void> {
  if (!auroraDebugEnabled()) return;
  try {
    const dir = join(process.cwd(), ".debug");
    await mkdir(dir, { recursive: true });
    const safeId = invoiceId.replace(/[^a-zA-Z0-9-]/g, "");
    let line = JSON.stringify({ ts: new Date().toISOString(), invoiceId, ...entry });
    const key = process.env.AURORA_API_KEY;
    if (key) line = line.split(key).join("***"); // the key must never reach disk
    await appendFile(join(dir, `aurora-${safeId}.jsonl`), line + "\n");
  } catch {
    console.warn("[aurora-debug] could not write debug log (ignored)");
  }
}

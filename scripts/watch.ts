/**
 * Live watcher for one invoice. Polls OUR API (which refreshes status from Aurora) and prints a line
 * whenever something changes, with time elapsed since the deposit address was created.
 *
 *   npm run watch -- <invoiceId>
 *
 * env: WATCH_BASE_URL (default http://localhost:3000), WATCH_INTERVAL_MS (default 5000)
 */
type Inv = {
  status: string;
  amountUsd: number;
  receivedAmount: number;
  depositAddress: string;
  aurora?: {
    state?: string;
    label?: string;
    quotedAt?: string;
    deadline?: string;
    amountInFormatted?: string;
    originSymbol?: string;
    chainLabel?: string;
    depositedFormatted?: string;
    refundedFormatted?: string;
    refundReason?: string;
    payoutTx?: { hash: string };
  };
};

const id = process.argv[2];
if (!id) {
  console.error("Usage: npm run watch -- <invoiceId>");
  process.exit(1);
}
const base = (process.env.WATCH_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const interval = Number(process.env.WATCH_INTERVAL_MS ?? 5000);
const startedAt = Date.now();

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

let lastKey = "";
let lastErr = "";
let headerShown = false;
let finalNoted = false;

async function tick() {
  try {
    const res = await fetch(`${base}/api/invoices/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) {
      const msg = `HTTP ${res.status} from ${base}`;
      if (msg !== lastErr) console.log(`[+${mmss(Date.now() - startedAt)}] ${msg}`);
      lastErr = msg;
      return;
    }
    lastErr = "";
    const inv = (await res.json()) as Inv;
    const a = inv.aurora;

    const originMs = a?.quotedAt ? Date.parse(a.quotedAt) : startedAt;
    const elapsed = mmss(Date.now() - originMs);

    if (!headerShown) {
      headerShown = true;
      console.log(`Watching invoice ${id} (poll every ${interval / 1000}s). Ctrl+C to stop.`);
      console.log(`Invoice: $${inv.amountUsd}${a ? ` | client must send ${a.amountInFormatted} ${a.originSymbol} on ${a.chainLabel ?? "?"}` : " | no payment quote yet"}`);
      if (inv.depositAddress) console.log(`Deposit address: ${inv.depositAddress}`);
      if (a?.deadline) console.log(`Quote deadline: ${a.deadline}`);
      console.log(`Elapsed is measured ${a?.quotedAt ? "since the deposit address was created" : "since this watcher started (no quote yet)"}.\n`);
    }

    const key = [inv.status, a?.state, a?.depositedFormatted, a?.refundedFormatted, inv.receivedAmount].join("|");
    if (key === lastKey) return;
    lastKey = key;

    const parts = [
      `[+${elapsed}]`,
      inv.status.padEnd(9),
      `| aurora: ${a?.state ?? "-"}${a?.label ? ` (${a.label})` : ""}`,
      `| deposited: ${a?.depositedFormatted ?? "-"}`,
      `| refunded: ${a?.refundedFormatted ?? "-"}`,
      `| received: $${inv.receivedAmount}`,
    ];
    if (a?.refundReason) parts.push(`| refundReason: ${a.refundReason}`);
    if (a?.payoutTx) parts.push(`| payoutTx: ${a.payoutTx.hash}`);
    console.log(parts.join(" "));

    if (!finalNoted && ["Paid", "Overpaid", "Refunded", "Failed"].includes(inv.status)) {
      finalNoted = true;
      console.log("       ^ looks final, but keep watching a few more minutes: refunds can arrive late. Ctrl+C to stop.");
    }
  } catch (e) {
    const msg = `cannot reach ${base} (${e instanceof Error ? e.message : "error"}). Is "npm run dev" running?`;
    if (msg !== lastErr) console.log(`[+${mmss(Date.now() - startedAt)}] ${msg}`);
    lastErr = msg;
  }
}

void tick();
setInterval(tick, interval);

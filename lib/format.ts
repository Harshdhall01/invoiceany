export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

export const fmtDate = (d: string) =>
  new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Token amount: up to 6 decimals, trailing zeros trimmed, at least 2 decimals ("10.5" -> "10.50"). */
export const amt = (n: number) => {
  if (!Number.isFinite(n)) return "0.00";
  const t = n.toFixed(6).replace(/0+$/, "");
  const [i, d = ""] = t.split(".");
  return `${i}.${d.padEnd(2, "0")}`;
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

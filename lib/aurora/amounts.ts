// 1 USDC = 1 USD (same assumption as the rest of the app).
// String math only, so big token amounts never go through floats.
export function usdToBaseUnits(usd: number, decimals: number): string {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("Amount must be a positive number");
  if (!Number.isInteger(decimals) || decimals < 2) throw new Error("Token must have at least 2 decimals");
  return String(Math.round(usd * 100)) + "0".repeat(decimals - 2);
}

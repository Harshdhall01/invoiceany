# InvoiceAny

Freelancer invoices. Clients pay from any chain (via Aurora Intents); the freelancer receives exactly the invoice amount in USDC on Solana.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000, connect Phantom (set it to **Devnet**), create an invoice, and you land on `/pay/<id>` with the deposit address and QR.

### Test payment states (mock provider)
On `/pay/<id>` a yellow dev panel appears when `PAYMENT_PROVIDER=mock`. Use **Exact / Underpay / Overpay / Reset**, or call:

```bash
curl -X POST localhost:3000/api/dev/simulate-payment \
  -H 'content-type: application/json' \
  -d '{"invoiceId":"<id>","amount":500}'
```
The endpoint is disabled in production and when the provider isn't `mock`.

## Env vars
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` (default) / `testnet` / `mainnet-beta` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | optional custom RPC |
| `PAYMENT_PROVIDER` | `mock` or `aurora` |
| `NEXT_PUBLIC_PAYMENT_PROVIDER` | same value; only toggles the dev panel in the UI |
| `AURORA_API_KEY`, `AURORA_DESTINATION_ASSET_ID`, ... | server-only, see `.env.example`. Never prefix with `NEXT_PUBLIC_` |
| `INVOICE_DB_FILE` | optional path for the JSON store (the tests use a temp file) |

## Layout
- `lib/types.ts`: `Invoice` type
- `lib/db.ts`: storage interface + JSON file store (`data/invoices.json`, gitignored). Swap in Supabase by implementing `InvoiceStore`.
- `lib/provider/`: `PaymentProvider` interface, `MockProvider`, `AuroraProvider`
- `lib/status.ts`: derives Paid/Underpaid/Overpaid/Expired/Pending from received amount + due date (0.01 USDC tolerance)
- `app/api/invoices`: `POST` create, `GET ?wallet=` list; `GET /api/invoices/[id]` returns the invoice with refreshed status

## Payment flow (Step D)
1. Client opens `/pay/<id>`, picks an asset (`GET /api/payment-options`, curated from Aurora's real token list) and enters a refund address.
2. `POST /api/invoices/<id>/quote-preview` runs a **dry** quote: shows the exact amount and fee before committing. Creates nothing.
3. `POST /api/invoices/<id>/payment` creates ONE real quote (unique deposit address). Idempotent and serialized per invoice: repeat calls return the same quote; Paid/Overpaid/Refunded invoices get `409`; Failed/Expired quotes may be replaced (old address kept in `quoteHistory`).
4. The page polls `GET /api/invoices/<id>` every 5s. With Aurora, status calls are limited to 1 per invoice per 3s and stop once the swap is `SUCCESS`/`REFUNDED`.

All errors are `{ "error": { "code", "message" } }`. The browser never receives the raw quote or the full refund address (`lib/public-invoice.ts`). Money values (amount, recipient, destination asset) always come from the stored invoice.

Limits: payment creation 10/min per IP, preview 30/min per IP (in-memory; use Redis/Upstash on serverless).

## Tests
```bash
npm test          # all *.test.ts via tsx
npm run typecheck
```

### Manual test with the mock provider
`PAYMENT_PROVIDER=mock`, `NEXT_PUBLIC_PAYMENT_PROVIDER=mock`, `npm run dev`. Create an invoice, pick an asset, enter any valid 0x address, click **Get payment address**, then use the yellow dev panel (Exact / Underpay / Overpay / Reset).

### Manual test with Aurora, no money spent
`PAYMENT_PROVIDER=aurora` (restart the dev server). On the pay page choose an asset and enter a valid refund address: the estimate card is a **dry quote** and costs nothing. **Stop there.** Clicking "Get payment address" creates a real quote with a live deposit address (no funds move unless someone sends to it).

## Known hackathon shortcuts
- No auth: anyone who knows a wallet address can list its invoices, and `POST /api/invoices` trusts the supplied wallet. Fix later with a signed-message (SIWS) check.
- JSON file store doesn't work on serverless hosts (read-only/ephemeral disk); move to Supabase before deploying to Vercel.
- After a `Refunded` outcome the invoice is closed (no second quote); the client must ask for a new invoice.
- Rate limits and per-invoice locks are in-memory (single server process).

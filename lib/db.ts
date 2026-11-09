import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Invoice } from "./types";

/** Callers only use the functions at the bottom; the store behind them is swappable. */
export interface InvoiceStore {
  create(invoice: Invoice): Promise<Invoice>;
  get(id: string): Promise<Invoice | null>;
  listByWallet(wallet: string): Promise<Invoice[]>;
  update(id: string, patch: Partial<Invoice>): Promise<Invoice | null>;
}

/* ------------------------------------------------------------------ */
/* Local dev store: JSON file                                          */
/* ------------------------------------------------------------------ */
class JsonFileStore implements InvoiceStore {
  private file = process.env.INVOICE_DB_FILE ?? path.join(process.cwd(), "data", "invoices.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Invoice[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as Invoice[];
    } catch (e: any) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }

  private async write(list: Invoice[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(list, null, 2));
    await fs.rename(tmp, this.file);
  }

  // Serialize all access so concurrent requests can't clobber each other.
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => undefined);
    return result;
  }

  create(invoice: Invoice) {
    return this.run(async () => {
      const list = await this.read();
      list.push(invoice);
      await this.write(list);
      return invoice;
    });
  }

  get(id: string) {
    return this.run(async () => (await this.read()).find((i) => i.id === id) ?? null);
  }

  listByWallet(wallet: string) {
    return this.run(async () =>
      (await this.read())
        .filter((i) => i.freelancerWallet === wallet)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }

  update(id: string, patch: Partial<Invoice>) {
    return this.run(async () => {
      const list = await this.read();
      const idx = list.findIndex((i) => i.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch, id };
      await this.write(list);
      return list[idx];
    });
  }
}

/* ------------------------------------------------------------------ */
/* Production store: Supabase (Postgres)                               */
/* ------------------------------------------------------------------ */
const TABLE = "invoices";

class SupabaseStore implements InvoiceStore {
  private db: SupabaseClient;

  constructor(url: string, key: string) {
    this.db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private fail(action: string, error: { message: string }): never {
    // Keep the message short; never include keys or URLs.
    throw new Error(`Storage error (${action}): ${error.message}`);
  }

  async create(invoice: Invoice) {
    const { error } = await this.db.from(TABLE).insert({
      id: invoice.id,
      freelancer_wallet: invoice.freelancerWallet,
      created_at: invoice.createdAt,
      data: invoice,
    });
    if (error) this.fail("create", error);
    return invoice;
  }

  async get(id: string) {
    const { data, error } = await this.db.from(TABLE).select("data").eq("id", id).maybeSingle();
    if (error) this.fail("get", error);
    return data ? (data.data as Invoice) : null;
  }

  async listByWallet(wallet: string) {
    const { data, error } = await this.db
      .from(TABLE)
      .select("data")
      .eq("freelancer_wallet", wallet)
      .order("created_at", { ascending: false });
    if (error) this.fail("list", error);
    return (data ?? []).map((r: any) => r.data as Invoice);
  }

  // Optimistic concurrency: only write if the row is still at the version we read.
  // Safe even when several serverless instances update the same invoice.
  async update(id: string, patch: Partial<Invoice>) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: row, error } = await this.db
        .from(TABLE)
        .select("data, version")
        .eq("id", id)
        .maybeSingle();
      if (error) this.fail("update-read", error);
      if (!row) return null;

      const next: Invoice = { ...(row.data as Invoice), ...patch, id };
      const { data: updated, error: e2 } = await this.db
        .from(TABLE)
        .update({ data: next, version: row.version + 1 })
        .eq("id", id)
        .eq("version", row.version)
        .select("data");
      if (e2) this.fail("update-write", e2);
      if (updated && updated.length === 1) return updated[0].data as Invoice;

      // Someone else changed the row first: wait a moment and retry.
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 50));
    }
    throw new Error("Storage error (update): too much contention, please retry");
  }
}

/* ------------------------------------------------------------------ */

function makeStore(): InvoiceStore {
  const kind = (process.env.STORAGE ?? "json").toLowerCase();
  if (kind === "supabase") {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("STORAGE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    }
    return new SupabaseStore(url, key);
  }
  return new JsonFileStore();
}

// Keep one instance across Next dev hot reloads.
const g = globalThis as unknown as { __invoiceStore?: InvoiceStore };
const store: InvoiceStore = (g.__invoiceStore ??= makeStore());

export const createInvoice = (invoice: Invoice) => store.create(invoice);
export const getInvoice = (id: string) => store.get(id);
export const listInvoicesByWallet = (wallet: string) => store.listByWallet(wallet);
export const updateInvoice = (id: string, patch: Partial<Invoice>) => store.update(id, patch);
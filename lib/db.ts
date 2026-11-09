import { promises as fs } from "fs";
import path from "path";
import type { Invoice } from "./types";

/** Swap this implementation for Supabase later; callers only use the functions below. */
export interface InvoiceStore {
  create(invoice: Invoice): Promise<Invoice>;
  get(id: string): Promise<Invoice | null>;
  listByWallet(wallet: string): Promise<Invoice[]>;
  update(id: string, patch: Partial<Invoice>): Promise<Invoice | null>;
}

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

// Keep one instance across Next dev hot reloads.
const g = globalThis as unknown as { __invoiceStore?: InvoiceStore };
const store: InvoiceStore = (g.__invoiceStore ??= new JsonFileStore());

export const createInvoice = (invoice: Invoice) => store.create(invoice);
export const getInvoice = (id: string) => store.get(id);
export const listInvoicesByWallet = (wallet: string) => store.listByWallet(wallet);
export const updateInvoice = (id: string, patch: Partial<Invoice>) => store.update(id, patch);

// Import this FIRST in every test file: points the JSON store at a temp file.
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

process.env.INVOICE_DB_FILE = path.join(mkdtempSync(path.join(tmpdir(), "invoiceany-")), "invoices.json");

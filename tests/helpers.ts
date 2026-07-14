/**
 * Test helpers. We spin up a fresh in-memory libSQL database for each test and
 * inject it into src/lib/db by mutating globalThis.__libsql (matching the
 * pattern used by src/lib/db.ts). This means the app code can be tested
 * without any file I/O.
 */
import { createClient, type Client } from "@libsql/client";
import { ensureSchema } from "../src/lib/schema";

type GlobalWithDb = typeof globalThis & { __libsql?: Client };

export async function makeTestDb(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  await ensureSchema(client);
  (globalThis as GlobalWithDb).__libsql = client;
  return client;
}

export async function resetTestDb(): Promise<void> {
  const g = globalThis as GlobalWithDb;
  if (g.__libsql) {
    g.__libsql.close();
    g.__libsql = undefined;
  }
}

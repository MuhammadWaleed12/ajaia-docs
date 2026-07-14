import { createClient, type Client, type InArgs, type ResultSet } from "@libsql/client";

type GlobalWithDb = typeof globalThis & { __libsql?: Client };

function build(): Client {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  return createClient({ url, authToken });
}

/**
 * Returns a cached libSQL client. Lazy so tests can swap in an in-memory
 * client (by setting globalThis.__libsql) *before* the app code opens a
 * connection. In dev Next.js hot-reloads modules and would otherwise open a
 * new connection on every request, so we also cache it on globalThis.
 */
export function getDb(): Client {
  const g = globalThis as GlobalWithDb;
  if (!g.__libsql) g.__libsql = build();
  return g.__libsql;
}

/**
 * A Proxy so existing callers can still do `db.execute(...)` without knowing
 * about the lazy wrapper. This keeps the call sites terse.
 */
export const db: Client = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Helper for a query returning multiple rows as objects. */
export async function all<T = Record<string, unknown>>(
  sql: string,
  args?: InArgs
): Promise<T[]> {
  const res: ResultSet = await getDb().execute({ sql, args: args ?? [] });
  return res.rows as unknown as T[];
}

/** Helper for a query returning a single row (or null). */
export async function one<T = Record<string, unknown>>(
  sql: string,
  args?: InArgs
): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

/** Helper for a mutation. Returns rowsAffected + lastInsertRowid. */
export async function run(sql: string, args?: InArgs) {
  return getDb().execute({ sql, args: args ?? [] });
}

/**
 * SQL schema for the documents app. Kept in code (rather than a separate .sql
 * file) so it can be applied consistently in scripts, tests, and at server
 * start-up. All statements are idempotent (`CREATE TABLE IF NOT EXISTS`), so
 * running `ensureSchema` multiple times is safe.
 */
import type { Client } from "@libsql/client";

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id         TEXT PRIMARY KEY,
     email      TEXT NOT NULL UNIQUE,
     name       TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS documents (
     id         TEXT PRIMARY KEY,
     title      TEXT NOT NULL,
     content    TEXT NOT NULL DEFAULT '',
     owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)`,
  `CREATE TABLE IF NOT EXISTS shares (
     document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     user_id     TEXT NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
     permission  TEXT NOT NULL CHECK (permission IN ('view','edit')),
     created_at  TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (document_id, user_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id)`,
  `CREATE TABLE IF NOT EXISTS attachments (
     id           TEXT PRIMARY KEY,
     document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     filename     TEXT NOT NULL,
     mime_type    TEXT NOT NULL,
     size_bytes   INTEGER NOT NULL,
     storage_path TEXT NOT NULL,
     created_at   TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_attachments_doc ON attachments(document_id)`,
];

export async function ensureSchema(client: Client): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    await client.execute(sql);
  }
}

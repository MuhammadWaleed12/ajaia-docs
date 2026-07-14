import { db } from "./db";
import { ensureSchema } from "./schema";

let initPromise: Promise<void> | null = null;

/**
 * Lazily ensures the database schema exists. Called from API routes so the app
 * "just works" on first run without a separate migration step. In production
 * you'd typically move this to a build/startup step, but for a small
 * single-instance app this is safe and idempotent.
 */
export function ensureInitialized(): Promise<void> {
  if (!initPromise) initPromise = ensureSchema(db);
  return initPromise;
}

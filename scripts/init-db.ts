/**
 * Creates the database schema. Idempotent, safe to run multiple times.
 * Usage: `npm run db:init`
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

loadDotenv();
process.env.DATABASE_URL ??= "file:./data/app.db";

async function main() {
  const url = process.env.DATABASE_URL!;
  if (url.startsWith("file:")) {
    const path = url.replace(/^file:/, "");
    mkdirSync(dirname(path), { recursive: true });
  }

  const { db } = await import("../src/lib/db");
  const { ensureSchema } = await import("../src/lib/schema");
  await ensureSchema(db);
  console.log("Schema ready at", url);
}

function loadDotenv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

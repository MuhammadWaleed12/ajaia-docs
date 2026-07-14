/**
 * Seeds a fresh set of demo users and documents (owned + shared).
 * Usage: `npm run db:seed`
 *
 * This is destructive: it wipes all data first. Only use in dev.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

loadDotenv();
process.env.DATABASE_URL ??= "file:./data/app.db";

async function main() {
  const url = process.env.DATABASE_URL!;
  if (url.startsWith("file:")) mkdirSync(dirname(url.replace(/^file:/, "")), { recursive: true });

  const { db } = await import("../src/lib/db");
  const { ensureSchema } = await import("../src/lib/schema");
  await ensureSchema(db);

  console.log("Clearing existing data…");
  await db.execute("DELETE FROM attachments");
  await db.execute("DELETE FROM shares");
  await db.execute("DELETE FROM documents");
  await db.execute("DELETE FROM users");

  const { upsertUser } = await import("../src/lib/users");
  const { createDocument, upsertShare } = await import("../src/lib/documents");

  console.log("Creating demo users…");
  const alice = await upsertUser({ email: "alice@ajaia.test", name: "Alice Nguyen" });
  const bob   = await upsertUser({ email: "bob@ajaia.test",   name: "Bob Martinez" });
  const carol = await upsertUser({ email: "carol@ajaia.test", name: "Carol Patel" });

  console.log("Creating demo documents…");
  const welcome = await createDocument({
    ownerId: alice.id,
    title: "Welcome to Ajaia Docs",
    content: `
<h1>Welcome to Ajaia Docs</h1>
<p>This is a small collaborative documents app. Try the toolbar above to make text <strong>bold</strong>, <em>italic</em>, or <u>underlined</u>.</p>
<h2>What you can do</h2>
<ul>
  <li>Create and rename documents</li>
  <li>Format text with headings and lists</li>
  <li>Share a document with another user</li>
  <li>Upload a .txt / .md / .docx file to create a new draft</li>
</ul>
<h2>Try it</h2>
<ol>
  <li>Open the sharing menu in the top-right</li>
  <li>Share this document with bob@ajaia.test</li>
  <li>Sign out and back in as Bob to see it under "Shared with me"</li>
</ol>
`.trim(),
  });

  const spec = await createDocument({
    ownerId: alice.id,
    title: "Product Spec Draft",
    content: `<h1>Product Spec Draft</h1><p>Owned by Alice, shared with Bob (editor) and Carol (viewer).</p>`,
  });
  await upsertShare({ documentId: spec.id,    userId: bob.id,   permission: "edit" });
  await upsertShare({ documentId: spec.id,    userId: carol.id, permission: "view" });
  await upsertShare({ documentId: welcome.id, userId: bob.id,   permission: "view" });

  const bobDoc = await createDocument({
    ownerId: bob.id,
    title: "Bob's private notes",
    content: `<h2>Private</h2><p>Only Bob should see this on their dashboard.</p>`,
  });
  await upsertShare({ documentId: bobDoc.id, userId: alice.id, permission: "edit" });

  console.log("Seed complete.");
  console.log("  Users:");
  console.log("    alice@ajaia.test  — Alice Nguyen");
  console.log("    bob@ajaia.test    — Bob Martinez");
  console.log("    carol@ajaia.test  — Carol Patel");
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

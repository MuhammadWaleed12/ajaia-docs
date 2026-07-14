# Architecture Note

> A short (~2 pages) explanation of the design decisions behind Ajaia Docs
> and, more importantly, **what I prioritized and why**.

---

## TL;DR

- **Next.js 14 (App Router) + TypeScript + Tailwind** on the front-end;
  **Tiptap** for rich text.
- **libSQL (SQLite)** on the back-end via `@libsql/client`, with a
  hand-written SQL schema. No ORM — the model is small and explicit SQL
  keeps the authorization queries obvious.
- **Local disk** for attachments through a 2-function `storage.ts` shim,
  designed to be swapped for S3/R2 later without touching call sites.
- **Cookie-based mocked auth**: session cookie holds a user id; no
  password. Explicitly permitted by the brief and clearly labelled as such
  in the UI and code.
- **Zero external services** for local development. `npm install && npm run
  db:init && npm run dev` and you're editing documents in a browser.

---

## What I prioritized (in order)

### 1. A correct authorization boundary above everything else

Every document access flows through **one** helper:

```ts
getDocumentForUser(id, userId, required: "view" | "edit")
  → { document, role: "owner" | "edit" | "view" }
```

It throws:

- `HttpError(404)` when the user has *no relationship at all* with the doc
  (so we don't leak existence), and
- `HttpError(403)` when they have `view` but requested `edit`.

Every mutation route calls it before doing anything else. This means:

- Adding a new field / column / feature only needs to answer *"which
  permission does this need?"* and the enforcement is free.
- The rule "shared users cannot see the collaborator list of a doc" is a
  one-line branch in `GET /api/documents/[id]`.
- All four combinations (owner / editor / viewer / stranger) have unit
  tests in `tests/documents.test.ts`.

I consider this the single most important piece of the codebase and it
got the most attention.

### 2. An editing experience that actually feels usable

The brief said "usable and coherent", not "match Google Docs". I
interpreted this as: the *baseline* has to feel considered.

- Tiptap over `contenteditable` because I've been bitten by
  `contenteditable` normalization bugs before.
- Autosave (debounced 800 ms) with a live status label so users are never
  wondering "did that save?".
- Inline title editing at the top of the doc, not a modal — matches user
  expectations from Google Docs / Notion.
- `⌘B` / `⌘I` / `⌘U` shortcuts work because Tiptap ships them.
- A `beforeunload` handler prevents accidental navigation while there's
  unsaved content.
- A role badge (Owner / Editor / Viewer) at the top of the editor and on
  every card so it's always obvious what you can and can't do.

### 3. Zero external services for local dev

libSQL as a local `file:./data/app.db`, uploads on local disk. This means
a reviewer can go from `git clone` to editing a document in **under 60
seconds** with no accounts to create, no keys to configure, no Docker.

### 4. A pluggable but honest storage layer

`src/lib/storage.ts` is a **tiny** interface (`writeUpload` /
`readUpload`) that's trivial to swap for S3 / R2 / Supabase Storage. I
deliberately did **not** hide it behind a factory abstraction with a
plugin registry — YAGNI for a coding exercise, and a `TODO` comment
saying "swap this file" is more honest.

### 5. Tests that would catch a real regression

Rather than spread thin coverage over every route, I focused Vitest on the
two highest-risk areas:

- The **authorization boundary** and share-lifecycle logic
  (`tests/documents.test.ts`).
- The **file-import format conversion** — the piece with the most edge
  cases and where a silent bug (e.g. failing to escape HTML in the
  markdown importer) would be a security issue
  (`tests/import.test.ts`).

15 tests, ~300 ms. In a follow-up PR I'd add React Testing Library tests
for the editor toolbar and a couple of Playwright e2e tests, but the
value-per-test drops sharply after the auth-boundary tests are in place.

---

## Data model

```
users(id, email UNIQUE, name, created_at)

documents(id, title, content, owner_id → users, created_at, updated_at)

shares(document_id → docs,
       user_id     → users,
       permission  CHECK IN ('view','edit'),
       PRIMARY KEY (document_id, user_id))

attachments(id, document_id → docs,
            filename, mime_type, size_bytes, storage_path,
            created_at)
```

A few small choices worth calling out:

- **`shares` has a composite PK** on `(document_id, user_id)`. This makes
  "share this doc with this person" a single idempotent
  `INSERT … ON CONFLICT DO UPDATE SET permission = excluded.permission`.
  The API doesn't need a separate "update share" endpoint.
- **All FKs use `ON DELETE CASCADE`.** Deleting a document cleans up its
  shares + attachment rows in one shot, and deleting a user tears down
  everything they own or are shared on. No orphan rows possible.
- **`documents.content` stores HTML** produced by Tiptap. I picked HTML
  over ProseMirror's JSON because:
  - it re-loads into Tiptap losslessly,
  - it makes the markdown / docx import path trivial (both produce HTML),
  - and it's a stable, portable format if someone ever wants to export.
- **Attachments store a `storage_path`, not the bytes.** The DB tracks
  metadata; the file store owns the bytes. This is what makes it easy to
  later move the bytes to S3 without a schema migration.

---

## Directory structure

```
src/app/                       # Next.js App Router pages + API routes
  login/                       # Mock login (email-based, no password)
  documents/                   # Dashboard + [id]/ editor + sharing dialog
  api/                         # JSON API routes (Node runtime)

src/lib/
  db.ts                        # Lazy libSQL client (Proxy so tests can inject)
  schema.ts                    # SQL DDL, idempotent (`CREATE TABLE IF NOT EXISTS…`)
  init.ts                      # Lazy schema-ensure for first-request bootstrap
  users.ts                     # findByEmail / upsertUser / listUsers
  documents.ts                 # CRUD + authorization + sharing + attachments
  session.ts                   # Cookie-based session (mocked auth) + HttpError
  storage.ts                   # Local file storage for attachments
  import.ts                    # .txt / .md / .docx → HTML conversion
  api.ts, client.ts, types.ts  # Small shared helpers

tests/                         # Vitest suites (in-memory SQLite)
scripts/                       # init-db.ts, seed.ts
Dockerfile, render.yaml, fly.toml   # Deploy configs
```

There is deliberately no `services/` vs. `repositories/` split — this is
a small enough app that the extra layer would be pure ceremony.

---

## What I intentionally left out

Documenting the *nos* is often as important as the *yeses*:

- **Real auth.** Passwords, OAuth, invitation emails, per-workspace user
  directories are all real product features. Here the session is just a
  cookie holding a user id. The brief explicitly permits this. Everything
  downstream (all the `requireSessionUser()` / `getDocumentForUser()`
  calls) only depends on a `User { id, email, name }` shape, so swapping
  in NextAuth / Clerk / WorkOS is a `session.ts` rewrite — nothing else
  changes.
- **Real-time collaborative editing.** No CRDT, no Yjs, no presence
  indicators. Two users editing the same doc simultaneously race on
  save; last write wins. Doing this properly (Yjs + a websocket relay +
  awareness UI) is a multi-day project on its own.
- **Rich-text extras.** No images, tables, code blocks, links, or
  colours. The brief scoped rich text to bold/italic/underline/headings/
  lists; adding more would be low-risk (Tiptap has extensions) but the
  brief was clear.
- **Rate limits, CSRF, audit logs, malware scanning on attachments.** Not
  in scope for a demo. `SameSite=Lax` on the session cookie mitigates the
  most common cross-site POST attacks but is not a full CSRF defense.
- **Sub-document permissions** (share only a paragraph, share as
  comment-only, expire access). Out of scope.
- **Search across document content.** Only title search on the dashboard.
- **Pagination.** The dashboard loads all accessible docs in one shot;
  fine for the demo, wrong past a few hundred docs.

---

## Notable trade-offs and small choices

- **libSQL vs. plain `better-sqlite3`.** libSQL's Node client is
  drop-in-swappable for hosted **Turso** by only changing the URL —
  useful for the "Vercel + Turso" migration path noted in the README —
  and its API is Promise-based, which fits Next.js's async route handlers
  more naturally.
- **Lazy DB client behind a Proxy.** `src/lib/db.ts` exports a Proxy over
  a lazily-constructed libSQL client. This lets `tests/helpers.ts` swap
  in an in-memory client via `globalThis.__libsql` **before** any app
  code opens a connection — no dependency injection framework, no monkey
  patching of imports.
- **Zod at the API boundary only.** Types inside the app are inferred
  from function signatures; Zod is used only to validate untrusted input
  (request bodies) so validation failures produce a clean 400 response.
- **`ensureInitialized()` on first request.** In production you'd move
  schema creation to a build/start step, but for a single-instance small
  app this is idempotent, cheap, and means "clone, install, run" just
  works with no extra migration command.
- **File imports produce HTML directly, not markdown-first.** The Tiptap
  editor eats HTML, so any indirection would just be an extra round
  trip. The trade-off is that I can't round-trip *back* to markdown from
  the editor — deemed acceptable since the brief doesn't mention export.

---

## What I would do next (if this were a real product)

1. Replace mocked auth with a real provider (NextAuth or Clerk).
2. Add Yjs for real-time collab; keep the current HTML column as a
   snapshot for search / export.
3. Move attachment storage to S3 / R2 (swap `storage.ts`).
4. Add Playwright end-to-end tests covering the two hero flows: "create,
   edit, refresh, still there" and "share doc, sign in as recipient, edit
   / can't edit depending on permission".
5. Add a small structured audit log (`events` table) so we can answer
   "who last edited this?" in the UI.

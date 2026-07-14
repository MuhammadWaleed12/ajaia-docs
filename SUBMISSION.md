# Submission Checklist

Everything in this submission, organised so a reviewer can find each piece
without reading the whole codebase.

---

## 1. Included documents

| File | Purpose |
| --- | --- |
| [`README.md`](./README.md) | Local setup, run commands, feature tour, deployment options. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Design decisions, data model, authorization strategy, trade-offs, what was intentionally left out. |
| [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) | How AI tooling (Cursor + Claude) was used, what was AI-generated vs. human-directed, and how the output was verified. |
| [`SUBMISSION.md`](./SUBMISSION.md) | This file. |

---

## 2. Brief-requirement → implementation map

### 2.1 Document Creation and Editing

| Requirement | Where in the code | How to verify |
| --- | --- | --- |
| Create a new document | `POST /api/documents` — `src/app/api/documents/route.ts`; UI: `New document` button on the dashboard. | Sign in → dashboard → **New document** → editor opens on a blank doc. |
| Rename a document | `PATCH /api/documents/[id]` (title patch); UI: inline title input in `src/app/documents/[id]/DocumentEditor.tsx`. | In the editor, type in the title field at the top — status changes to "Saving…" then "Saved". |
| Edit document content in browser | Tiptap editor in `src/app/documents/[id]/Editor.tsx`. | Type in the body; formatting toolbar responds. |
| Save & reopen | Autosave in `DocumentEditor.tsx` (debounced 800 ms); persistence via `documents.content` column. | Type → wait 1 s → refresh → your text is still there. |
| Bold / italic / underline | Toolbar buttons + `⌘B` / `⌘I` / `⌘U` shortcuts. Configured in `Editor.tsx`. | Select text → click **B** / **I** / **U**. |
| Headings / text-size variation | H1 / H2 / H3 / P toolbar buttons. Tiptap `StarterKit.heading({ levels: [1,2,3] })`. | Click **H1**, **H2**, **H3**, **P**. |
| Bulleted / numbered lists | `•` and `1.` toolbar buttons. | Click each; type; list items render. |

### 2.2 File Upload

The brief lists three example behaviors and asks for **at least one**; this
project ships **two** so the workflow is complete:

| Behavior | Where | How to verify |
| --- | --- | --- |
| Upload `.txt` / `.md` / `.docx` → new editable document | `POST /api/documents/import` (`src/app/api/documents/import/route.ts`); converter in `src/lib/import.ts`; UI: **Import file** button on the dashboard. | Dashboard → **Import file** → pick `some.md` → opens as a new doc with headings / lists preserved. |
| Attach files to an existing document | `POST /api/documents/[id]/attachments` (`src/app/api/documents/[id]/attachments/route.ts`); download: `GET /api/documents/[id]/attachments/[attachmentId]`; UI: `src/app/documents/[id]/AttachmentsPanel.tsx`. | Open any doc you own → Attachments section → **Add file** → the file appears with a download link. |

Supported types and limits are stated in the UI **and** in the README
`Feature tour` section (imports: `.txt`, `.md`, `.docx` only; attachments:
any type, capped at 10 MB).

### 2.3 Sharing

| Requirement | Where | How to verify |
| --- | --- | --- |
| Document owner | `documents.owner_id` FK; enforced by `getDocumentForUser()` in `src/lib/documents.ts`. | Every doc row has an `owner_id`; UI badge reads "Owner". |
| Grant another user access | `POST /api/documents/[id]/shares`; UI: **Share** dialog (`ShareDialog.tsx`). | Owner clicks Share → enters email → picks Viewer/Editor → recipient sees the doc under "Shared with me". |
| Visible distinction owned vs. shared | Dashboard has **Owned by me** / **Shared with me** tabs (`DocumentsDashboard.tsx`) plus per-card role badges (Owner / Editor / Viewer). | See dashboard. |
| Simulated users | Cookie-based mock auth (`src/lib/session.ts`); `POST /api/auth/login` creates or looks up a user by email. Seeded demo accounts in `scripts/seed.ts`. | Sign in as `alice@ajaia.test`, then sign out and back in as `bob@ajaia.test`. |

Authorization rules enforced by `getDocumentForUser(id, userId, required)`:

- **Owner** → full access.
- **Shared editor** → view + edit; **cannot** delete.
- **Shared viewer** → view only; edit → `403`.
- **No relationship** → `404` (existence hidden).

### 2.4 Persistence

| Requirement | Where | How to verify |
| --- | --- | --- |
| Documents survive refresh | SQLite (`data/app.db`) via libSQL; `documents.content` stores Tiptap-produced HTML. | Refresh mid-edit; content is exactly as saved. |
| Formatting preserved | Round-trips as HTML — no lossy conversion. | Apply bold + heading + list → refresh → still bold, heading, list. |
| Shared access is demonstrable | Persistent `shares` table with composite PK; enforced by every access. | Share as Alice → sign in as Bob → doc visible in Bob's dashboard. |

### 2.5 Product & Engineering Quality

| Requirement | Where |
| --- | --- |
| Clear setup and run instructions | [`README.md § 1 Local setup`](./README.md) — `npm install && npm run db:init && npm run dev`. |
| Working deployment path | [`README.md § 4 Deploying`](./README.md) — three paths documented (Render blueprint, Fly.io, generic Docker). Configs included: `Dockerfile`, `render.yaml`, `fly.toml`. |
| Basic validation & error handling | Zod on every mutating API route; `HttpError` → typed JSON error responses via `src/lib/api.ts`; 401 / 403 / 404 / 413 all used correctly. |
| At least one meaningful automated test | 15 Vitest tests in `tests/`. Not toy tests — they cover the authorization boundary (`documents.test.ts`) and file-import safety including HTML escaping (`import.test.ts`). |
| Short architecture note | [`ARCHITECTURE.md`](./ARCHITECTURE.md). |

---

## 3. Deliverable inventory

### 3.1 Source tree

```
src/app/                            # Next.js App Router (pages + API routes)
  layout.tsx, page.tsx, globals.css
  login/                            # Mock login page + form
  documents/                        # Dashboard + [id]/ editor
    layout.tsx, page.tsx
    DocumentsDashboard.tsx, HeaderUserMenu.tsx
    [id]/
      page.tsx, DocumentEditor.tsx
      Editor.tsx                    # Tiptap wrapper + toolbar
      ShareDialog.tsx               # Share-with-email dialog
      AttachmentsPanel.tsx          # Attachments list + upload
      not-found.tsx
  api/
    auth/{login,logout,me}/route.ts
    users/route.ts
    documents/route.ts              # List + create
    documents/[id]/route.ts         # Get / patch / delete
    documents/[id]/shares/route.ts  # List + upsert shares
    documents/[id]/shares/[userId]/route.ts   # Delete share
    documents/[id]/attachments/route.ts       # List + upload
    documents/[id]/attachments/[attachmentId]/route.ts  # Download
    documents/import/route.ts       # Import .txt / .md / .docx

src/lib/
  db.ts          # Lazy libSQL client (Proxy)
  schema.ts      # SQL DDL, idempotent
  init.ts        # Lazy schema ensure
  users.ts       # User repo
  documents.ts   # Documents / shares / attachments repo + authz
  session.ts     # Cookie session + HttpError
  storage.ts     # Local file store for attachments
  import.ts      # File → HTML converter
  api.ts, client.ts, types.ts, id.ts
```

### 3.2 Tests

```
tests/
  helpers.ts             # In-memory libSQL setup / teardown
  documents.test.ts      # 7 tests: authorization + share lifecycle
  import.test.ts         # 8 tests: markdown / txt / docx conversion + XSS escaping
```

Run: `npm test` — 15 tests, all passing, ~300 ms.

### 3.3 Scripts

```
scripts/
  init-db.ts   # npm run db:init — creates schema (idempotent)
  seed.ts      # npm run db:seed — wipes + seeds demo users and docs
```

### 3.4 Deployment configs

```
Dockerfile        # Multi-stage node:20-alpine image; runs as non-root; ports 3000
.dockerignore
render.yaml       # Render Blueprint: web service + 1 GB persistent disk
fly.toml          # Fly.io config: single machine + 1 GB volume at /data
```

### 3.5 Config files

```
package.json          # Dependencies + scripts
tsconfig.json         # TS strict, App Router settings
tailwind.config.ts    # Content globs + brand palette
postcss.config.mjs
next.config.mjs       # externalize libSQL + mammoth for server runtime
vitest.config.ts      # Node env + @/* alias
.eslintrc.json        # extends next/core-web-vitals
.env.example          # Documented env vars
```

---

## 4. Verification recipe (copy-paste)

```bash
# 1. Setup
npm install
cp .env.example .env
npm run db:init
npm run db:seed

# 2. Tests + build + lint should all pass
npm test          # 15/15
npm run build     # clean build, 13 routes
npm run lint      # zero warnings

# 3. Run and click through
npm run dev
# open http://localhost:3000 and sign in as alice@ajaia.test
```

To exercise the sharing model end-to-end with two accounts, open the app in
two different browsers (or one normal + one private window) and sign in as
`alice@ajaia.test` in one and `bob@ajaia.test` in the other.

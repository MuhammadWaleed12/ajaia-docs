# Ajaia Docs

A tiny full-stack documents app: create, rename, and rich-text-edit documents
in the browser; import `.txt` / `.md` / `.docx` files as new drafts; attach
files to any document; and share documents with other users as **viewers** or
**editors**.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tiptap**, and
**SQLite (libSQL)**. Everything (database + uploaded files) is persisted to
local disk out of the box — no external services required for local dev.

> **Companion docs:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) explains the
> design decisions and trade-offs. [`AI_WORKFLOW.md`](./AI_WORKFLOW.md)
> describes how AI tooling was used to build this.
> [`SUBMISSION.md`](./SUBMISSION.md) is the deliverables checklist.

---

## 1. Local setup

**Requirements:** Node.js 20+ (tested on 20 and 24). No database server, no
Docker, nothing else.

```bash
git clone <this-repo>
cd Ajaia
npm install
cp .env.example .env
npm run db:init      # creates ./data/app.db with the schema
npm run db:seed      # (optional) creates 3 demo users + a few docs
npm run dev          # http://localhost:3000
```

Then open [http://localhost:3000](http://localhost:3000) and sign in as any
email (mocked auth), or click one of the seeded demo users:

| Email               | Name          |
| ------------------- | ------------- |
| `alice@ajaia.test`  | Alice Nguyen  |
| `bob@ajaia.test`    | Bob Martinez  |
| `carol@ajaia.test`  | Carol Patel   |

Alice starts with a welcome doc and a spec that she has shared with Bob
(editor) and Carol (viewer). Bob has a private doc he has shared back to
Alice — this makes it easy to see the "owned vs. shared" behavior end-to-end
by signing in as different users.

### Environment variables

`.env.example` is a working baseline; copy it to `.env` and edit if you need
to.

| Var                  | Default                | Purpose                                              |
| -------------------- | ---------------------- | ---------------------------------------------------- |
| `DATABASE_URL`       | `file:./data/app.db`   | libSQL URL. Also accepts `libsql://…` (Turso).       |
| `DATABASE_AUTH_TOKEN`| _(unset)_              | Auth token when using a remote libSQL / Turso URL.   |
| `UPLOAD_DIR`         | `./uploads`            | Directory for uploaded attachments.                  |
| `SESSION_SECRET`     | `dev-secret-…`         | Reserved for future signed-cookie use.               |

---

## 2. Running

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Start the app in dev mode (`http://localhost:3000`)       |
| `npm run build`     | Production build                                          |
| `npm start`         | Serve the production build                                |
| `npm run db:init`   | Create the schema (idempotent, safe to re-run)            |
| `npm run db:seed`   | **Wipe + seed** demo users and documents (dev only)       |
| `npm test`          | Run the Vitest suite once                                 |
| `npm run test:watch`| Vitest watch mode                                         |
| `npm run lint`      | ESLint via `next lint`                                    |

### Verified locally

- `npm run build` — Next.js 14 production build, no warnings.
- `npm test` — 15 tests, all passing, ~300 ms.
- `npm run lint` — zero warnings / errors.
- End-to-end HTTP smoke against `npm start`: login → create → rename → edit →
  share → view-as-shared-user → attempt-edit-as-viewer (correctly 403) →
  upload attachment → download attachment as collaborator (200) → same
  download unauthenticated (401).

---

## 3. Feature tour

- **Create / rename / edit** — Big **New document** button on the dashboard.
  Title is edited inline at the top of the page; body uses a Tiptap editor.
- **Rich-text formatting** — Bold, italic, underline, H1 / H2 / H3, bulleted
  and numbered lists. Undo / redo. `⌘B` / `⌘I` / `⌘U` shortcuts.
- **Autosave** — Content is saved ~800 ms after you stop typing; a status
  message shows "Saving… / Saved 3:04 PM / Save failed — …". Refreshes
  restore exactly what was saved.
- **Import a file into a new draft** — On the dashboard, click
  **Import file** and pick a `.txt`, `.md`, or `.docx`. The file is
  converted to formatted HTML and opened as a new document you own. `.docx`
  is handled by `mammoth`; markdown by a small hand-rolled subset
  (headings, lists, bold, italic, HTML escaping).
- **Attach files to a document** — Inside a doc, use **Add file** in the
  Attachments section. Everyone with access can download.
- **Sharing** — Owners see a **Share** button. Enter an email address and
  pick Viewer or Editor. If the email isn't a known user yet, a placeholder
  account is created and they can sign in later. Owners can change
  permissions or remove collaborators; collaborators can remove themselves.
  Editors can edit content and add attachments; viewers cannot.
- **Owned vs. shared** — Dashboard has **Owned by me** and **Shared with
  me** tabs, plus a role badge (Owner / Editor / Viewer) on every card and
  at the top of the editor.
- **Delete** — Only the owner sees a Delete affordance on their own
  document cards.

### File-type limits (stated up front, per the brief)

- **Import**: `.txt`, `.md` / `.markdown`, `.docx` only. Anything else
  returns a clear error to the user.
- **Attachments**: any file type. Hard-capped at **10 MB** per file to
  keep the local upload store bounded.

---

## 4. Deploying

The app supports two deployment shapes:

- **Serverless / free-tier hosts** (Render free, Vercel, etc.) — use
  **Turso** (free hosted libSQL) for the database. Attachments live on the
  container's ephemeral filesystem.
- **Any host with a persistent disk** (Fly.io, Render Starter+, self-hosted
  Docker) — SQLite + local uploads on a mounted volume, just like local dev.

### Option A — Render free tier + Turso (recommended, fully $0)

1. **Create a free Turso database** (no card required):

   ```bash
   # Install the Turso CLI (or use the web UI at https://turso.tech)
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   turso db create ajaia
   turso db show ajaia --url          # copy the libsql://... URL
   turso db tokens create ajaia       # copy the token
   ```

2. **Push this repo to GitHub.**

3. In Render, **New → Blueprint**, point at your fork. Render reads
   `render.yaml` and provisions a Dockerized web service on the free plan.
   It will prompt you for two secrets — paste the values from step 1:
   - `DATABASE_URL` → the `libsql://…` URL
   - `DATABASE_AUTH_TOKEN` → the token

4. First request creates the schema automatically.

5. (Optional) Seed demo users into Turso from your laptop:

   ```bash
   DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" npm run db:seed
   ```

   Or just sign in through the app with any email — the mock-auth flow
   creates the user on the fly.

> **Attachments caveat:** on the free tier the container has no persistent
> disk, so uploaded attachment *files* survive within a running container
> but are lost on redeploy / spin-down. The database rows for uploads still
> exist, so a stale link would 404. All other data (users, documents,
> shares) persists in Turso forever. To make attachments fully persistent
> on Render free, either upgrade to the Starter plan (see Option D) or swap
> `src/lib/storage.ts` for object storage (S3 / R2 / Supabase Storage).

### Option B — Fly.io (SQLite + volume, everything persists)

```bash
fly launch --no-deploy --copy-config      # accept defaults, keep fly.toml
fly volumes create ajaia_data --size 1
fly deploy
fly ssh console -C "npm run db:seed"      # optional demo data
```

### Option C — Any Docker host (SQLite + volume, everything persists)

```bash
docker build -t ajaia-docs .
docker run -p 3000:3000 \
  -v ajaia-data:/app/data \
  -v ajaia-uploads:/app/uploads \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  ajaia-docs
```

### Option D — Render Starter plan (~$7/mo, everything persists)

If you'd rather not depend on Turso and want persistent attachments too,
change `render.yaml` back to `plan: starter` and add a `disk:` block —
Starter supports persistent disks (~$0.25/GB/month).

### Note on Vercel

Vercel's serverless functions have an ephemeral filesystem, so it works
with the same Turso setup as Option A. You'd still need to swap
`src/lib/storage.ts` for object storage (S3 / R2 / Supabase Storage) if
you want attachments to survive across deploys. The Render blueprint is
the fastest zero-config path.

---

## 5. Testing

```bash
npm test                 # one-shot
npm run test:watch       # watch mode
```

Tests live in `tests/` and use **Vitest** with an in-memory libSQL database.
15 tests cover:

- The full **authorization boundary** (owner / editor / viewer / no access);
- **Share upsert idempotency** and share removal;
- `listDocumentsForUser` merging owned + shared with correct role tags;
- The **file-import** conversion (markdown subset, `.txt` → HTML, HTML
  escaping, unsupported-file rejection).

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for why these areas were chosen
over blanket coverage.

---

## 6. Where to look next

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — design decisions, data model,
  authorization strategy, trade-offs, what was intentionally left out.
- [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) — how AI tooling (Cursor with Claude)
  was used to build this, and what was verified by hand.
- [`SUBMISSION.md`](./SUBMISSION.md) — checklist of every deliverable and
  where to find each capability in the code.

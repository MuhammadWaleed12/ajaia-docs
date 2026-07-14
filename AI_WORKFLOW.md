# AI Workflow Note

> An honest description of how AI tooling was used to build Ajaia Docs,
> what I (the human) drove, and how I verified the output.

---

## Tools used

- **Cursor IDE** with the built-in agent (Claude, Anthropic).
- **No** Copilot, no ChatGPT web UI, no other model.
- The agent had file-system + terminal access inside the project directory
  and used them to run `npm install`, `npm test`, `npx next build`,
  `curl`, and short bash scripts against a local `npm start` server.

Everything else — deploy configs, tests, README, this document — was
written in the same Cursor session.

---

## How the work was structured

I ran the build as a single planned pass rather than a chat back-and-forth:

1. **Read the brief carefully.** Identified the five capabilities the
   brief calls out (creation/editing, upload, sharing, persistence,
   engineering quality) and turned them into a 12-item TODO list before
   writing any code. This kept the agent from drifting into
   nice-to-haves before the core loop worked.
2. **Locked the tech stack up-front**: Next.js 14 App Router + TypeScript
   + Tailwind + Tiptap + libSQL. Chosen for the properties in
   [`ARCHITECTURE.md`](./ARCHITECTURE.md) — mainly, single-process
   deploy, zero external services for local dev, and a rich-text editor
   with a sane extension model.
3. **Built bottom-up in dependency order**: schema → DB helpers → repo
   layer → auth → API routes → UI. This meant every layer was already
   exercisable by `curl` before the layer above it existed.
4. **Wrote tests against the highest-risk code first** (the authorization
   boundary and the file-import conversion). Any regression in either
   would either be a security bug or a silent data-corruption bug, so
   they got the coverage.
5. **Verified everything by running it, not by reading it.** See
   [Verification](#verification) below.

---

## What was AI-generated vs. hand-directed

Honest breakdown:

| Area | AI wrote | I directed / decided |
| --- | --- | --- |
| Tech stack choice | — | 100%: Next.js + libSQL + Tiptap were my call before the agent wrote a line. |
| SQL schema (`schema.ts`) | Drafted by AI | I specified the tables, cascade behavior, and the composite PK on `shares`. |
| Authorization design (`getDocumentForUser`) | Implemented by AI | I designed the "return `{document, role}`, throw 404 for strangers, 403 for view-vs-edit" contract explicitly, because leaking existence is a real problem. |
| Rich-text editor + toolbar | AI wrote the Tiptap glue | I specified exactly which formatting extensions to include (matched the brief) and the toolbar layout. |
| Sharing dialog UX | AI wrote the component | I specified the "create placeholder user on unknown email" behavior and the owner-vs-collaborator permission rules. |
| Autosave logic | AI wrote it | I decided on debounced-800ms + live status label + `beforeunload` guard. |
| File-import parser | AI wrote it, including the tiny markdown subset | I decided *not* to add a full markdown dependency, and I wrote the test cases for HTML escaping (script tags in markdown input). |
| Deployment configs (`Dockerfile`, `render.yaml`, `fly.toml`) | AI drafted | I picked Render + Fly as the two viable paths and specified the single-disk constraint on Render. |
| Tests | AI wrote them | I picked what to cover and reviewed every assertion. |
| Docs (README, this file, ARCHITECTURE, SUBMISSION) | AI drafted | I directed the structure and reviewed for accuracy against the code that actually shipped. |

The pattern I found most productive: **I own the design decisions and the
verification; the agent owns the typing**. The agent is much faster than
me at scaffolding Tailwind classes, wiring up Zod schemas, and writing
boilerplate route handlers, but it will confidently generate a plausible
but wrong authorization rule if left to its own devices.

---

## Verification

I did **not** trust "the agent said it works". Everything shipped was
verified by running it:

1. **`npm test`** — 15 Vitest tests, all passing (~300 ms). Covers the
   authorization boundary (owner / editor / viewer / stranger), share
   upsert idempotency, share removal, and the file-import conversion
   including HTML escaping.
2. **`npm run build`** — Next.js 14 production build with zero warnings
   and TypeScript strict mode. Every route (13 routes) compiles cleanly.
3. **`npm run lint`** — ESLint (`next/core-web-vitals`) reports zero
   warnings / errors.
4. **End-to-end HTTP smoke test.** Booted `npm start`, then ran a shell
   script via `curl` that exercises:
   - Login as Alice → create doc → rename → edit content;
   - Share with Bob as **editor** → sign in as Bob → confirm doc shows
     up under "shared" with `sharedPermission: "edit"`;
   - Bob edits (200) → Bob deletes (403 "Only the owner can delete") →
     Bob's edit persists;
   - Import a `.md` file → verify headings + lists come through in the
     resulting document HTML;
   - Upload an attachment as Alice → download as Bob (200, correct
     bytes) → download as anonymous (401);
   - Change Bob's permission to `view` → Bob edits (403 "You have
     view-only access").

   Every case produced the expected status code and body.
5. **Manual UI walkthrough.** Ran `npm run dev`, signed in as each demo
   user in a private window, clicked through create / rename / share /
   upload / attach / delete, and verified badges, autosave status, and
   role-based UI (Share button only for owner, Add-file button only for
   editor+).

When an intermediate build or test failed (Node `Buffer` vs. DOM
`BodyInit` typing on the attachment download route, and an initial
attempt to eagerly construct the DB client before tests could inject
one), I read the error, formed a hypothesis, and directed the fix. The
agent did not silently paper over failures.

---

## Things the agent got wrong on the first pass

Recording these because "it just worked" is rarely true:

- **First DB module design was eager.** It called `createClient()` at
  module-load time, which meant tests couldn't inject an in-memory
  client. I asked for a lazy Proxy-based design; the agent implemented
  it and all tests then passed.
- **Attachment download route** hit a real TypeScript ergonomics issue
  (`Buffer<ArrayBufferLike>` isn't assignable to DOM `BodyInit`). The
  first two attempts (Uint8Array view, then `Blob`) both hit the same
  underlying `SharedArrayBuffer` vs. `ArrayBuffer` collision. The third
  attempt (copy into a fresh `ArrayBuffer`) worked. Small cost, clean
  types.
- **First seed script referenced a non-existent `dotenv-lite` package.**
  Caught in review before running; replaced with an inline `.env`
  parser (10 lines).
- **Lint had 3 unescaped-entity errors** in the share dialog copy;
  fixed with `&ldquo;` / `&rdquo;` / `&apos;`.

None of these were shipped.

---

## What I did *not* use AI for

- Deciding the product model (owned vs. shared, viewer vs. editor,
  attach-to-doc as the file-upload behavior).
- Choosing the tech stack.
- Deciding which tests to write.
- Deciding what to intentionally leave out (documented in
  `ARCHITECTURE.md § What I intentionally left out`).
- Final review of every file before considering it done.

---

## Time budget

Total wall-clock: single working session (~one focused sitting). The
biggest single time sinks were (a) the initial `npm install` (~2 min for
537 packages), and (b) the manual UI walkthrough at the end.

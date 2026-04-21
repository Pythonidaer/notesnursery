# Notes Nursery

A React single-page app for importing Apple Notes–style Markdown, organizing notes with labels, and editing them in the browser. **Local mode** keeps everything in memory (no login). **Production mode** uses **Supabase** (email auth + Postgres + RLS) so notes persist per user.

## Core features

- **Import** (home `/`) — multi-file `.md` upload, parsed into title, body, and optional `Created` / `Modified` metadata; in production, signed-in users with existing notes are redirected from `/` to **Library**
- **Library** (`/library`) — browse notes with label and date filters, optional grouping by date, optional **comedy rating** sort (admin + Comedy label; see below)
- **Cards** (`/cards`) — same filters in a card layout
- **Note detail** (`/notes/:id`) — read with sanitized HTML or legacy Markdown; **edit** in a **TipTap** rich-text editor (toolbar, HTML saved to `body_html`); optional **audio clips** (`.wav` / `.mp3`) uploaded to private Supabase Storage and embedded in the note body; labels; transfer selected text to another note; delete with confirmation
- **Instructions** (`/instructions`) — in-app guidance
- **New note composer** — docked bottom-right panel; **expand** widens the same right-anchored sheet (non-blocking, no backdrop); TipTap rich editor and HTML storage; Library, Cards, and note detail
- **Labels** — per-note labels; in production, profiles can store a **default label** used when opening Library/Cards
- **Comedy performance ratings** — half-step stars (0.5–5) on notes with a **Comedy** label, persisted in Supabase when enabled; UI entry is gated to a configured admin email (see `src/utils/comedyRating.js`)

## Semantic search (new)

Notes Nursery includes **semantic search** in production: you can find notes by **meaning**, not only exact keywords. The Library has a **Semantic search** box (when signed in). Under the hood this uses **embeddings**, **Postgres + pgvector**, and **Supabase Edge Functions** (`gte-small`). This is **retrieval** (find relevant notes)—not a chat bot or full **RAG** answer generator.

**Example query:** *“notes about boxing and footwork”*

Full setup, concepts, backfill, testing, and security: **[docs/SEMANTIC_SEARCH.md](docs/SEMANTIC_SEARCH.md)**.

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | React 19 |
| Routing | React Router 7 |
| Build | Vite 6 |
| Backend (production) | Supabase (Auth + Postgres + `@supabase/supabase-js`) |
| Styling | Global CSS + CSS Modules |

## Modes

Controlled by `VITE_APP_MODE` and Supabase env vars:

### Local mode (default)

- Set `VITE_APP_MODE=local` or omit it.
- Notes stay **in memory** (refresh clears them).
- **No login** for import, edit, labels, or the floating composer.
- Supabase env vars are **not** required.

### Production mode

- Set `VITE_APP_MODE=production` **and** provide Supabase URL + anon key.
- **Supabase Auth** (email + password) and **Postgres** for notes and labels.
- Import, save, and create note **persist** for the signed-in user; unauthenticated users are sent to **Log in** when a flow needs persistence.

If `VITE_APP_MODE=production` but URL/key are missing, the app falls back to local-style in-memory behavior so builds still work.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APP_MODE` | No | `local` (default) or `production` |
| `VITE_SUPABASE_URL` | Production + Supabase | Project URL (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Production + Supabase | `anon` `public` key |
| `VITE_SITE_URL` | Recommended in production | Public site origin for email confirmation redirects (e.g. `https://app.example.com`) |

Copy `.env.example` to `.env.local` and adjust.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql` (tables, indexes, RLS).
3. **Authentication → Providers**: enable Email; for development you may disable “Confirm email” so sign-up logs in immediately.
4. **Authentication → URL Configuration**: add your real site URL and redirect allow list entries the app uses after email confirmation, for example `https://YOUR_DOMAIN/auth/email-confirmed` (and `http://localhost:5173/auth/email-confirmed` for local testing). Set **`VITE_SITE_URL`** in production builds to your deployed origin (no trailing slash) so verification emails use that host instead of localhost.
5. Copy **Project URL** and **anon public** key into `.env.local` with `VITE_APP_MODE=production`.

### Tables (summary)

- `profiles` — user id, username, optional default label preference
- `notes` — `body_html` (primary for edited notes), optional legacy `body_markdown`, `content_type` (`html` \| `markdown`), metadata (including optional `comedy_rating`)
- `labels` — per-user label names
- `note_labels` — many-to-many between notes and labels
- `note_embeddings` — semantic search: one row per note per user (`user_id`, `note_id`, `source_text`, `embedding` as `vector(384)`, `updated_at`); see [docs/SEMANTIC_SEARCH.md](docs/SEMANTIC_SEARCH.md)

Apply `supabase/migrations/*.sql` on existing projects so `notes` includes hybrid columns (`004_hybrid_note_content.sql`), optional audio display names (`005_note_audio_display_names.sql`), and semantic search RLS/RPC (`006_semantic_search_rls_and_rpc.sql`) once `note_embeddings` exists in your project.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

Semantic search (production / Supabase):

```bash
# After migration + function deploys; use a valid user JWT for SUPABASE_ACCESS_TOKEN
npm run backfill:embeddings
npm run test:embed
```

See [docs/SEMANTIC_SEARCH.md](docs/SEMANTIC_SEARCH.md) for env vars and deploy steps.

## How to test

### Local mode

```bash
# .env.local
VITE_APP_MODE=local
```

1. Open `/`, import `.md` files → Library lists notes (memory only).
2. Open a note: edit body, labels, floating new note, import — no login.

### Production mode (with Supabase)

```bash
VITE_APP_MODE=production
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

1. **Sign up** at `/signup` (username, email, password).
2. **Log in** at `/login`.
3. **Import** notes — they should appear in the library and survive refresh.
4. Open a note, **edit**, and save — updates persist via Supabase.
5. **Labels** — add/remove; refresh and confirm they persist.
6. **Add note** (+) opens the composer; **Create note** inserts into Postgres.

## Development notes

- Auth UI is custom React (no Supabase Auth UI package).
- Client code uses the **anon** key only; RLS enforces per-user access.
- SQL lives in `supabase/schema.sql` for a repeatable setup.
- Higher-level docs live in `docs/` — [Semantic search](docs/SEMANTIC_SEARCH.md); see also `docs/NOTE_EDITING.md` for the rich editor, HTML pipeline, and audio embeds (if present).

## Future To Dos

- Optional: lazy-load the note editor (TipTap) and/or Markdown rendering to reduce initial JS size
- Optional: storage cleanup for orphaned audio, export flows (toolbar upload is documented in `docs/NOTE_EDITING.md`)
- Explore technology for detecting laughs, or at minimum mapping audio volume or intensity to text size and spacing

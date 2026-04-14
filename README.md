# Notes Nursery

A React single-page app for importing Apple Notes–style Markdown, organizing notes with labels, and editing them in the browser. **Local mode** keeps everything in memory (no login). **Production mode** uses **Supabase** (email auth + Postgres + RLS) so notes persist per user.

## Core features

- **Import** (home `/`) — multi-file `.md` upload, parsed into title, body, and optional `Created` / `Modified` metadata
- **Library** (`/library`) — browse notes with label and date filters, optional grouping by date, optional **comedy rating** sort (admin + Comedy label; see below)
- **Cards** (`/cards`) — same filters in a card layout
- **Note detail** (`/notes/:id`) — read with sanitized HTML or legacy Markdown; **edit** in a **TipTap** rich-text editor (toolbar, HTML saved to `body_html`); labels; transfer selected text to another note; delete with confirmation
- **Instructions** (`/instructions`) — in-app guidance
- **Floating composer** — create new notes (rich editor, HTML storage) from Library or Cards
- **Labels** — per-note labels; in production, profiles can store a **default label** used when opening Library/Cards
- **Comedy performance ratings** — half-step stars (0.5–5) on notes with a **Comedy** label, persisted in Supabase when enabled; UI entry is gated to a configured admin email (see `src/utils/comedyRating.js`)

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

Copy `.env.example` to `.env.local` and adjust.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql` (tables, indexes, RLS).
3. **Authentication → Providers**: enable Email; for development you may disable “Confirm email” so sign-up logs in immediately.
4. Copy **Project URL** and **anon public** key into `.env.local` with `VITE_APP_MODE=production`.

### Tables (summary)

- `profiles` — user id, username, optional default label preference
- `notes` — `body_html` (primary for edited notes), optional legacy `body_markdown`, `content_type` (`html` \| `markdown`), metadata (including optional `comedy_rating`)
- `labels` — per-user label names
- `note_labels` — many-to-many between notes and labels

Apply `supabase/migrations/*.sql` on existing projects so `notes` includes hybrid columns (`004_hybrid_note_content.sql`).

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

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
- Higher-level docs live in `/docs` (see `docs/NOTE_EDITING.md` for the rich editor and storage model).

## Future To Dos

- Optional: lazy-load the note editor (TipTap) and/or Markdown rendering to reduce initial JS size
- Experiment with exporting and uploading audio files
- Explore technology for detecting laughs, or at minimum mapping audio volume or intensity to text size and spacing

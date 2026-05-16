# Notes Nursery

A React single-page app for importing Apple Notes–style Markdown, organizing notes with labels, and editing them in the browser. **Local mode** keeps everything in memory (no login). **Production mode** uses **Supabase** (email auth + Postgres + RLS) so notes persist per user.

## Core features

- **Import** (home `/`) — multi-file `.md` upload, parsed into title, body, and optional `Created` / `Modified` metadata; in production, signed-in users with existing notes are redirected from `/` to **Library**
- **Library** (`/library`) — browse notes with label and date filters, optional grouping by date, optional **comedy rating** sort (admin + Comedy label; see below)
- **Cards** (`/cards`) — same filters in a card layout
- **Note detail** (`/notes/:id`) — read with sanitized HTML or legacy Markdown; **edit** in a **TipTap** rich-text editor (toolbar, HTML saved to `body_html`); optional **audio clips** (`.wav` / `.mp3`) uploaded to private Supabase Storage and embedded in the note body; labels; transfer selected text to another note; delete with confirmation
- **Instructions** (`/instructions`) — in-app guidance
- **Analysis** (`/analysis`, beta) — full-width **MP3 waveforms** for files in the user’s private note-audio library (Supabase Storage); optional **A/B compare** of a second track; **desktop-sized viewports** only (~900px+). Requires production mode + sign-in. See [Audio analysis (waveforms)](#audio-analysis-waveforms) below.
- **New note composer** — docked bottom-right panel; **expand** widens the same right-anchored sheet (non-blocking, no backdrop); TipTap rich editor and HTML storage; Library, Cards, and note detail
- **Labels** — per-note labels; in production, profiles can store a **default label** used when opening Library/Cards
- **Comedy performance ratings** — half-step stars (0.5–5) on notes with a **Comedy** label, persisted in Supabase when enabled; UI entry is gated to a configured admin email (see `src/utils/comedyRating.js`)

## Semantic search

Notes Nursery includes **semantic search** in production: you can find notes by **meaning**, not only exact keywords. The Library has a **Semantic search** box (when signed in). Under the hood this uses **embeddings**, **Postgres + pgvector**, and **Supabase Edge Functions** (`gte-small`). This is **retrieval** (find relevant notes)—not a chat bot or full **RAG** answer generator.

**Example query:** *“notes about boxing and footwork”*

Full setup, concepts, backfill, testing, and security: **[docs/SEMANTIC_SEARCH.md](docs/SEMANTIC_SEARCH.md)**.

## Audio analysis (waveforms)

The **Analysis** page (`/analysis`) is an experimental (**Beta**) tool to **inspect and play** full-length recordings as **waveforms**—not a transcript or laugh detector, but a visual + transport surface for the same private **MP3** assets used in notes (Supabase Storage bucket for note audio).

- **When it works:** `VITE_APP_MODE=production` with Supabase configured, user **signed in**. Local-only mode without Supabase shows a short “use cloud / editor” message instead of the full UI.
- **Sources:** The app lists **.mp3** files already in your **note audio** library (uploaded from a note or from Analysis). You can **upload** additional MP3s (validated, size-capped) into that library; display names are stored like other note-audio files.
- **Player:** The waveform uses **WaveSurfer.js** (with a time **Timeline** plugin), a hidden `audio` element, and custom controls: play/pause, volume/mute, file metadata (e.g. size), and a header **file picker** / dismiss to close the current waveform. Signed URLs are created client-side for playback.
- **Compare:** You can add a **second** MP3 to view **stacked** waveforms and compare two tracks (primary track, then an optional “compare” track with its own row).
- **Layout:** Copy and key controls use the same **`PageContentWrap`** max width as **Library** / **Cards**; the **waveform area** is **full-bleed** in the main column for a wide read. **Narrow / mobile** viewports are intentionally blocked with a “desktop only” message (this screen is designed for a large monitor).
- **Nav:** **Analysis** appears in the app header; route **`/analysis`**.

## Image to text (OCR)

The note **editor** can import text from a photo via the **scan** control on the toolbar. That uses the Edge Function **`ocr-image-to-text`**, which calls [OCR.space](https://ocr.space) on the **server** (your OCR API key must never go in `VITE_*` env vars or client code).

If the UI says **OCR could not be reached** or **Failed to send a request to the Edge Function**, the browser is not getting a valid response from that function. Fix it on the **same Supabase project** as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`:

1. Install and log in to the [Supabase CLI](https://supabase.com/docs/guides/cli): `npx supabase login`
2. From the repo root, link the project: `npx supabase link --project-ref <your-project-ref>`
3. Set the [OCR.space](https://ocr.space) API key as a function secret:  
   `npx supabase secrets set OCR_SPACE_API_KEY=<your-ocr-key>`
4. Deploy the function:  
   `npx supabase functions deploy ocr-image-to-text`

In the **Supabase Dashboard → Edge Functions**, you should see **`ocr-image-to-text`** after a successful deploy. A key only in your laptop `.env` file does **not** configure Edge Functions—you must set secrets in Supabase (CLI or Dashboard).

**Who sees the OCR button:** Same **admin email** as comedy star ratings — see **`COMEDY_RATING_ADMIN_EMAIL`** in **`src/utils/comedyRating.js`**. The OCR gate reuses `isAdminComedyRatingUser` in **`src/utils/ocrImageToTextGate.js`** (UI-only).

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

### Session persistence (production)

The app stores the Supabase session in **browser localStorage** (`sb-<project-ref>-auth-token`). If you are sent to **Log in** after revisiting the site:

1. **DevTools → Application → Local Storage** (same origin as the app):
   - After sign-in: the `sb-*-auth-token` key should exist.
   - When logged out unexpectedly: if the key is **missing**, storage was cleared or you are on a different origin (`www` vs apex, `http` vs `https`, or a preview URL without production env). If the key is **present**, check the Network tab for failed `grant_type=refresh_token` requests and the console for `[auth]` messages (dev builds log auth events).
2. **Vercel (or host) environment** for the deployment you use:
   - `VITE_APP_MODE=production`
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set and matching **Project Settings → API**
   - Recommended: `VITE_SITE_URL` = your public origin (no trailing slash)
3. **Supabase Dashboard → Authentication**:
   - **URL Configuration**: **Site URL** exactly matches how users open the app; redirect URLs include `https://YOUR_DOMAIN/auth/email-confirmed`
   - **Providers → Email**: if **Confirm email** is on, there is no session until the user confirms
   - **Settings** (JWT / sessions): review access-token expiry, refresh-token lifetime, rotation, and inactivity limits

### Tables (summary)

- `profiles` — user id, username, optional default label preference, optional `color_scheme` (`light` \| `dark`) for appearance
- `notes` — `body_html` (primary for edited notes), optional legacy `body_markdown`, `content_type` (`html` \| `markdown`), metadata (including optional `comedy_rating`)
- `labels` — per-user label names
- `note_labels` — many-to-many between notes and labels
- `note_embeddings` — semantic search: one row per note per user (`user_id`, `note_id`, `source_text`, `embedding` as `vector(384)`, `updated_at`); see [docs/SEMANTIC_SEARCH.md](docs/SEMANTIC_SEARCH.md)

Apply `supabase/migrations/*.sql` on existing projects so `notes` includes hybrid columns (`004_hybrid_note_content.sql`), optional audio display names (`005_note_audio_display_names.sql`), semantic search RLS/RPC (`006_semantic_search_rls_and_rpc.sql`) once `note_embeddings` exists, and profile appearance (`007_profile_color_scheme.sql`).

### Note-audio storage bucket

Create a **private** bucket named `note-audio` (if it does not exist) with allowed MIME types **`audio/mpeg`** (`.mp3`) and **`audio/wav`** (manual uploads). **Record** (`/recordings`) converts to MP3 in the browser before upload — you do **not** need WebM/M4A on the bucket. See [docs/recording-sessions.md](docs/recording-sessions.md).

For **Voice Memos** delete to work, run `supabase/migrations/009_note_audio_storage_policies.sql` so authenticated users can **DELETE** their own objects (see [docs/voice-memos.md](docs/voice-memos.md)).

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

## Future Enhancements

### Hybrid Search (Planned)

Today, **semantic search** finds notes by **meaning**—ideas and paraphrases—using vector similarity. That works well for concepts, but it is not always ideal for **exact names or very short, specific phrases**.

For example, searching for **“Bell in Hand”** might not rank the right note as highly if the note is long: the model compresses the whole note into one embedding, and an exact phrase can be a small part of the signal, so it may look less “similar” to the query than you expect.

**Hybrid search** (a planned improvement) would combine two kinds of retrieval:

- **Semantic similarity** — same idea as today: “what is this note *about*?”
- **Keyword / text matching** — “does this note *contain* the exact words (or a close string match)?”

Together, you get:

- **Exact** matches (names, titles, specific phrases) that should not be buried
- **Semantic** matches (related ideas, different wording) that semantic search already handles well

**Example** — query: *“bell in hand”*

- A **keyword** pass finds notes that actually contain that phrase in the text or title.
- A **semantic** pass can still surface related notes (e.g. a note about a Boston tavern or historic bar, even with different words).
- **Merging** both signals should improve overall ranking and reduce misses.

This is a planned improvement and not yet implemented. A more technical design outline for contributors lives in [docs/HYBRID_SEARCH.md](docs/HYBRID_SEARCH.md).

## Future To Dos

- **Rich editor toolbar:** nested list **indent / outdent** controls (currently removed until the sink/lift behavior is reliable across list types), plus a **table / grid** insert control
- Optional: lazy-load the note editor (TipTap) and/or Markdown rendering to reduce initial JS size
- Optional: storage cleanup for orphaned audio, export flows (toolbar upload is documented in `docs/NOTE_EDITING.md`)
- Explore technology for detecting laughs, or at minimum mapping audio volume or intensity to text size and spacing

# Notes Nursery

A place where you can upload your Apple Notes and step out of the walled garden.

## Modes

The app runs in one of two modes, controlled by `VITE_APP_MODE`:

### Local mode (default)

- Set `VITE_APP_MODE=local` or omit it.
- Notes stay **in memory** in the browser (refresh clears them).
- **No login required** for import, edit, labels, or the floating “new note” composer.
- Supabase env vars are **not** required.

### Production mode

- Set `VITE_APP_MODE=production` **and** provide Supabase credentials.
- The app uses **Supabase Auth** (email + password) and **Postgres** for notes and labels.
- Import, save, create note, and updates **persist** to the database for the signed-in user.
- Unauthenticated users are sent to **Log in** when a flow requires persistence (import, save shortcut, create note in production).

If `VITE_APP_MODE=production` but URL/key are missing, the app falls back to **local-style** in-memory behavior so builds still work.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APP_MODE` | No | `local` (default) or `production` |
| `VITE_SUPABASE_URL` | Production + Supabase | Project URL (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Production + Supabase | `anon` `public` key |

Copy `.env.example` to `.env.local` and adjust.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the script in `supabase/schema.sql` (tables, indexes, RLS policies).
3. **Authentication → Providers**: enable Email; for development you may disable “Confirm email” so sign-up logs in immediately.
4. Copy **Project URL** and **anon public** key into `.env.local` with `VITE_APP_MODE=production`.

### Tables (summary)

- `profiles` — `id` (auth user id), `username`, `created_at`
- `notes` — note content and metadata per user
- `labels` — per-user label names
- `note_labels` — many-to-many between notes and labels

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

1. Open `/`, import `.md` files → library lists notes (memory only).
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
4. Open a note, **edit** and use **Save** (placeholder still redirects to login if not signed in — when signed in, persistence is via autosave to DB on update).
5. **Labels** — add/remove; refresh and confirm they persist.
6. **Add note** (+) opens the composer; **Create note** inserts into Postgres.

## Development notes

- Auth UI is custom React (no Supabase Auth UI package).
- Client code uses the **anon** key only; RLS enforces per-user access.
- SQL lives in `supabase/schema.sql` for a clear, repeatable setup.

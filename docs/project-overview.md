# Notes Nursery — Project Overview

**Notes Nursery** is a single-page React application for importing, organizing, and editing notes—especially those exported from Apple Notes as Markdown. It supports a **local development mode** (in-memory storage, no login) and a **production mode** backed by **Supabase** (authentication + Postgres + Row Level Security).

## Purpose

- Import one or more Markdown files that match the app’s expected shape (Apple Notes export style).
- Browse notes in a **library** with optional grouping by date and filtering by label.
- Open a **note detail** view for reading, editing (Markdown or lossy plain-text HTML body), labeling, and metadata.
- Create new notes in-app and move snippets between notes without leaving the page.

## Tech Stack

| Layer | Choice |
|--------|--------|
| UI | React 19 |
| Routing | React Router 7 |
| Build | Vite 6 |
| Backend (production) | Supabase (Auth + Postgres + `@supabase/supabase-js`) |
| Styling | Global CSS + CSS Modules per component/page |

## Runtime Modes

Configured via **`VITE_APP_MODE`** and Supabase env vars (see `src/config/appConfig.js`):

- **`local`** (default): Notes live in React state only; no Supabase persistence; auth is not required for saves.
- **`production`** with Supabase URL + anon key: Notes load and persist per signed-in user; create/update/delete flows require authentication when persistence is remote.

## Repository Layout (high level)

```
src/
  App.jsx              # Routes + shell
  main.jsx             # Providers: Router, Auth, Notes
  config/              # appConfig (mode, Supabase flags)
  context/             # AuthContext, NotesContext
  data/                # Supabase note helpers
  pages/               # Import, Library, Note detail, Login, Signup
  components/          # Composers, modals, pickers, toast, etc.
  utils/               # Parsing, dates, labels, HTML/plain conversion, note content model
supabase/              # SQL schema + migrations
```

## Who This Doc Set Is For

- Developers onboarding to the repo
- AI assistants (e.g. Cursor) applying consistent changes
- Anyone planning features against the **current** architecture

For deeper detail, see [architecture.md](./architecture.md), [data-model.md](./data-model.md), and [features.md](./features.md).

## Hybrid note bodies

Notes may be either **Markdown** (`content_type = markdown`, `body_markdown`) or **HTML** (`content_type = html`, `body_html`). Imports from Apple Notes exports typically arrive as HTML. **New notes** created in-app use the **TipTap** composer and persist as **`content_type = html`** in `body_html`. See [data-model.md](./data-model.md) and [NOTE_EDITING.md](./NOTE_EDITING.md).
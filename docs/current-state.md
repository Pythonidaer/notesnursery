# Current State

_Last reviewed alongside the in-repo implementation; update this file when major behavior changes._

## What Works

- **Vite + React** SPA with client-side routing.
- **Dual mode**: local in-memory vs Supabase-backed production (`VITE_APP_MODE`, Supabase env vars).
- **Notes CRUD** through `NotesContext` with Supabase implementations for remote.
- **Hybrid note content**: `content_type` distinguishes Markdown (`body_markdown`) from HTML (`body_html`); imports arrive as HTML; note-detail **edit** uses TipTap and **save** persists HTML; legacy Markdown migrates on save.
- **Import** of Apple-style Markdown files with metadata fallbacks (stored as HTML content type when the body is HTML-heavy).
- **Library** browsing with label and date filters and optional date grouping.
- **Note detail** read/edit with sanitized rendering (`NoteBodyContent`), TipTap rich editor on edit, label management, info modal, delete confirmation modal.
- **New-note composer** (`FloatingNewNoteComposer`): **docked** bottom-right panel; **expanded** is a wider **right-anchored** sheet with **no** blocking backdrop; **Add to existing note** remains a separate compact floating panel (`NoteTransferPanel`).
- **Selection → transfer to another note** with Markdown-aware append for Markdown destinations.
- **Toasts** and library **flash toast** via router state for post-navigation messages.

## Known Constraints / Simplifications

- **HTML → Markdown conversion** for editing is best-effort (Turndown); very complex HTML may not round-trip perfectly; saving still produces safe Markdown rendering.
- **No offline/PWA** packaging in the default setup.
- **No automated test suite** in `package.json` (only `dev`, `build`, `preview`).
- **Supabase** schema must match app expectations; run migrations (including hybrid content) on every deployed environment.

## Dependencies

- Runtime: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `react-markdown`, `remark-gfm`, `rehype-raw`, `rehype-sanitize`, `dompurify`, `turndown`, `turndown-plugin-gfm`.
- Build: `vite`, `@vitejs/plugin-react`.

## Documentation

This `/docs` folder is the primary high-level reference for humans and AI assistants. Code comments and `supabase/schema.sql` remain authoritative for exact column and policy details.

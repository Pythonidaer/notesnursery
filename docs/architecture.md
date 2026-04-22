# Architecture

## Application Shell

- **`BrowserRouter`** wraps the app (`src/main.jsx`).
- **`AuthProvider`** exposes session user and Supabase auth helpers (`src/context/AuthContext.jsx`).
- **`NotesProvider`** owns the in-memory note list and delegates persistence to local state vs `src/data/notesSupabase.js` based on config (`src/context/NotesContext.jsx`).
- **`App`** renders a fixed header (brand + nav) and **`<Routes>`** for each page (`src/App.jsx`).

## Routing

| Path | Page | Role |
|------|------|------|
| `/` | `ImportPage` | File upload + parse + `addNotes` |
| `/library` | `LibraryPage` | List notes, filters, optional date grouping |
| `/notes/:noteId` | `NoteDetailPage` | Read/edit note, labels, delete, composers |
| `/login`, `/signup` | `LoginPage`, `SignupPage` | Supabase email auth |

Production mode with Supabase may redirect unauthenticated users away from protected views (e.g. note detail) per page logic.

## Data Flow

1. **Import**: Files are read as text → `parseAppleNoteMarkdown` → `addNotes` on `NotesContext` (stored as `content_type = html` / `body_html`).
2. **Remote**: On login, `NotesContext` fetches all notes for the user (`fetchNotesForUser`), including joined labels and hybrid body fields (`content_type`, `body_html`, `body_markdown`).
3. **Mutations**: `updateNote`, `deleteNote`, and `addNotes` update local state; in production they call Supabase and then merge results into `notes`.
4. **Rendering**: `NoteBodyContent` chooses Markdown (react-markdown + remark-gfm + rehype pipeline with sanitization) vs sanitized HTML (`DOMPurify`) based on `content_type`.

## Layering

- **Pages** orchestrate UI and call context hooks.
- **Context** is the single source of truth for the note array and loading/error flags.
- **`notesSupabase.js`** maps app types (camelCase) ↔ DB columns (snake_case), syncs `note_labels`, and performs CRUD.
- **Utils** stay pure: parsing, date classification, HTML/plain conversion, label collection, note content helpers (`noteContentModel.js`), Markdown insertion helpers (`markdownTextareaOps.js` used by `MarkdownToolbar.jsx`).

## Notable UI Patterns

- **CSS Modules** beside components (e.g. `NoteDetailPage.module.css`).
- **Toast**: lightweight fixed-position message (`components/Toast.jsx`).
- **Modals**: portal-based dialogs (e.g. `NoteInfoModal`, `DeleteNoteModal`).
- **New-note composer**: `FloatingNewNoteComposer` is a **single** `<aside>` (`docked` by default). **Expanded** is the **same** `aside` with **`panelExpanded`** — a **right-anchored** full-height sheet (**no** backdrop, **no** modal semantics, **no** scroll lock or focus trap). Main content stays interactive beside/behind the uncovered area; **+** on Library, Cards, Note detail opens the docked composer.
- **Floating panels**: fixed bottom-right for **Add to existing note** (`NoteTransferPanel` reuses shared compact chrome classes from `FloatingNewNoteComposer.module.css`).

## Environment

Vite exposes `import.meta.env.VITE_*`:

- `VITE_APP_MODE` — `production` enables Supabase backend when credentials exist.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project.

See `src/config/appConfig.js` for helpers: `isLocalMode`, `useSupabaseBackend`, `requiresAuthForPersistence`.

## Build

- `npm run dev` — Vite dev server  
- `npm run build` — production bundle to `dist/`  
- No separate API server; the app is static + Supabase client-side.
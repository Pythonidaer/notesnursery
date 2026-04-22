# Features

## Import

- Multi-file upload on **Import** (`/`).
- Parses Markdown via **`parseAppleNoteMarkdown`**: title from first `#` line, body, optional trailing `Created:` / `Modified:` lines.
- Ensures **`createdAtSource`** is always set (fallback ISO timestamp when missing).
- Adds notes through **`NotesContext.addNotes`** (local append or Supabase upsert loop).
- Imported bodies are stored as **`content_type = html`** in `body_html` (Apple Notes exports are often HTML-heavy).

## Library

- Lists all notes with title and read-only **label chips** per row.
- **Label filter** (all / unlabeled / specific label).
- **Date filter** derived from note content (`groupNotesByDate` utilities).
- Toggle **flat list** vs **group by date** (relative buckets: today, previous 30 days, year, etc.).

## Note Detail

- **Read** — Markdown notes render from `body_markdown` (GFM + limited inline HTML, sanitized). HTML notes render from `body_html` (sanitized). See `src/components/NoteBodyContent.jsx`.
- **Edit** — **TipTap rich-text** (`NoteRichTextEditor.jsx`): WYSIWYG body with toolbar, HTML saved to `body_html`, **`content_type = html`**, `body_markdown` cleared for legacy rows. Legacy Markdown is converted when entering edit; saving migrates to HTML. Discard restores the pre-edit snapshot.
- **Labels**: searchable combobox-style **`LabelPicker`** (add/remove labels, persisted on change).
- **Source created**: editable in edit mode (**Source modified** is not editable in UI; still stored).
- **Note info** modal: source filename, created/modified metadata (read-only).
- **Delete** with in-app confirmation modal (no `window.confirm`).
- **New note** — **`FloatingNewNoteComposer`**: **+** opens the **docked** bottom-right composer; **Expand** grows the **same** right-anchored sheet (non-blocking: no backdrop; main note stays interactive). **Collapse** / **Close** are explicit; **Escape** closes when docked. Creates **`content_type = html`** with sanitized **`body_html`** (see `NOTE_EDITING.md`).
- **Transfer selection**: when text is selected in body or editor, **Add to Existing Note** opens **`NoteTransferPanel`** (compact bottom-right panel) to pick another note, append snippet, and save. This flow does **not** use the expanded new-note composer.

## Auth (Production)

- **Login** / **Signup** with Supabase email flow (`AuthContext`).
- Protected flows use **`requiresAuthForPersistence()`** to redirect to login when remote persistence is required.

## Feedback

- **Toast** for saves, deletes (incl. flash after navigate to library), and “added to note”.
- Inline **action errors** on note detail when operations fail.

## Modes

- **Local**: full UI without Supabase; data lost on refresh.
- **Production + Supabase**: load/save per user; RLS on server.

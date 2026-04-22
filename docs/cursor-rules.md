# Cursor / AI Rules for Notes Nursery

Use these when editing this repository in Cursor or similar tools. They complement any project `.cursor/rules` files.

## Scope & Discipline

- Prefer **small, focused changes** that match the task. Avoid drive-by refactors and unrelated file edits.
- **Do not** add new dependencies unless the user explicitly wants them or the task requires it.
- **Do not** create documentation files unless asked (this `/docs` folder is maintained deliberately).

## Code Style

- Match existing patterns: **CSS Modules** next to components, **functional components**, hooks at top level.
- Preserve **local vs production** behavior: check `src/config/appConfig.js` (`useSupabaseBackend`, `requiresAuthForPersistence`).
- Note shape is **`ParsedNote`** (camelCase in app, snake_case in Supabase via `notesSupabase.js`), including **`contentType`**, **`bodyMarkdown`**, and **`bodyHtml`** for hybrid Markdown vs HTML storage.

## Data & Auth

- Mutations go through **`NotesContext`** (`addNotes`, `updateNote`, `deleteNote`); avoid duplicating Supabase calls in pages unless necessary.
- Production saves often require **`user`**; redirect to **`/login`** when `requiresAuthForPersistence()` is true and there is no user.

## UI Conventions

- Reuse **Toast**, existing **modal** patterns, and **LabelPicker** / **NotePicker** combobox styling for consistency.
- Destructive actions: use the in-app **DeleteNoteModal** pattern, not `window.confirm`.

## Testing

- Run **`npm run build`** after substantive changes to ensure the bundle compiles.
- If you add tests later, align with whatever runner the project adopts.

## Environment

- Never commit **secrets**. `.env` is local; document variables in README or `docs/` without real keys.

## When Unsure

- Read **`docs/architecture.md`** and **`docs/data-model.md`** first.
- Inspect **`NotesContext.jsx`** and **`notesSupabase.js`** before changing persistence behavior.

# Cursor Rules

- Always read /docs before making changes
- Do NOT rewrite large files unnecessarily
- Prefer small, incremental changes
- Preserve existing architecture
- Keep components simple and readable
- Avoid overengineering
- Explain changes after implementing
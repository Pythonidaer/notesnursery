# Next Steps

Possible improvements in rough priority order (not a committed roadmap):

## Quality & Safety

- Add **unit tests** for parsers (`parseAppleNoteMarkdown`, `parseAppleNoteDateString`, `groupNotesByDate`) and critical context reducers.
- Add **E2E smoke tests** (e.g. Playwright) for import → library → open note → save.

## Product

- Optional: bring **Add to existing note** (`NoteTransferPanel`) up to the same full-screen / large-dialog ergonomics as the new-note composer if long-form append workflows need it.
- **Richer editing** (optional): toolbar snippets, split-pane editor, or WYSIWYG—only if product scope grows beyond textarea + preview.
- **Search** across titles/body in the library.
- **Export** notes back to Markdown/files.

## Technical

- **Error boundaries** around route sections for nicer failure UX.
- **Loading skeletons** consistency across library and detail where missing.
- **Environment docs** in README: required `VITE_*` vars and Supabase setup checklist.

## Supabase

- Confirm **RLS** and **migrations** are applied in every deployed environment.
- Optional: **realtime** subscriptions for multi-device sync (large scope).

## Performance

- Virtualize long library lists if note counts grow large.
- Debounce or memoize heavy list derivations if profiling shows need.

_Update this list when priorities change; link PRs or issues when you use external tracking._

# Next Steps

1. Mobile navigation + layout
2. Help pages:
   - AppleScript guide
   - Mobile export guide
   - Manual markdown guide
3. Favorites feature
4. Comedy cards view by year
5. Star rating system (0–5, half steps)
# Data Model

## In-Memory / App Type: `ParsedNote`

Defined in `src/context/NotesContext.jsx` (JSDoc):

| Field | Type | Description |
|--------|------|-------------|
| `id` | `string` (UUID) | Primary key |
| `sourceFileName` | `string` | Original filename or placeholder (e.g. floating composer sentinel) |
| `title` | `string` | Note title |
| `contentType` | `string` | `markdown` or `html` — which field is authoritative for body |
| `bodyMarkdown` | `string` | Markdown source when `contentType === 'markdown'` |
| `bodyHtml` | `string` | HTML when `contentType === 'html'` (imports, legacy in-app HTML); often `''` for markdown notes |
| `createdAtSource` | `string` | Apple-style or ISO date string for display/filtering |
| `modifiedAtSource` | `string` | Same; optional metadata |
| `comedyRating` | `number \| null` | Optional half-step rating when Comedy label + admin rules apply |
| `labels` | `string[]` | Label names (normalized in places via `utils/noteLabels.js`) |

Helpers:

- `src/utils/noteContentModel.js` — `normalizeContentType`, `getNoteBodyPlain` (previews, transfer, HTML edit plain text).
- `src/utils/noteBodyPlain.js` — `htmlToPlain`, `plainTextToHtmlBody` (e.g. transfer panel saving to HTML destinations).
- `src/utils/htmlToMarkdownForEdit.js` — HTML → Markdown for the unified note-detail editor: DOMPurify; preprocess `<br>` / empty `div` / adjacent `</div><div>` for Apple Notes–style HTML; Turndown with `br: '\n'`, GFM plugin, custom root/non-root `div` rules; post-process spacing outside fenced code blocks.
- `src/utils/markdownTextareaOps.js` — pure functions to insert/wrap Markdown from textarea selection (used by `MarkdownToolbar.jsx` in note detail and floating composer).

## Supabase / Postgres

Schema: `supabase/schema.sql`; incremental changes: `supabase/migrations/`.

### `public.notes`

- `id` (uuid, PK)  
- `user_id` (uuid → `auth.users`)  
- `title`, `source_file_name`  
- `body_html` (text, not null default `''`) — HTML body for `content_type = 'html'`  
- `body_markdown` (text, nullable) — Markdown for `content_type = 'markdown'`  
- `content_type` (text, not null, default `'html'`, check: `markdown` \| `html`)  
- `created_at`, `updated_at` (timestamptz)  
- `created_at_source`, `modified_at_source` (text, optional Apple metadata)  
- `comedy_rating` (numeric, nullable)

**Compatibility:** Imports and untouched legacy rows may keep `content_type = 'html'` with content in `body_html`. New in-app notes and **any note saved from note detail** use `content_type = 'markdown'` with `body_markdown`. Opening edit on an HTML note converts the body to Markdown for editing; **saving** migrates that row to Markdown (no silent DB migration for notes the user never edits).

### `public.labels`

- Per-user label names; unique `(user_id, name)`.

### `public.note_labels`

- Many-to-many between notes and labels.

### `public.profiles`

- Optional profile row keyed by `auth.users.id` (e.g. username, default label).

Row Level Security (RLS) policies restrict reads/writes to `auth.uid() = user_id` (or own profile) where applicable.

## Mapping

`src/data/notesSupabase.js` maps rows ↔ `ParsedNote` and handles:

- Inserts/updates for notes (including `content_type`, `body_markdown`, `body_html`)  
- `syncNoteLabels` when `labels` are present on a note payload  

## Dates

- **Display / grouping**: `parseAppleNoteDateString` and `normalizeNoteSourceDateInput` (`src/utils/parseAppleNoteDate.js`) support human-readable Apple exports and ISO strings.
- **Effective date for sorting/buckets**: `getEffectiveNoteDate` in `src/utils/groupNotesByDate.js` prefers modified, then created source fields.

## Import Normalization

`parseAppleNoteMarkdown` (`src/utils/parseAppleNoteMarkdown.js`) produces `contentType: 'html'` and stores the file body in `bodyHtml` (Apple exports are often HTML-heavy). It assigns a fallback **`createdAtSource`** when metadata is missing or unparseable.

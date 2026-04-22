# Apple Notes import and HTML semantics

## Pipeline overview

1. **Export** — The bulk AppleScript (`src/data/appleNotesBulkExport.applescript`) writes each note as a `.md` file: first line `# Title`, then the note **body** from Apple Notes (HTML and/or **plain text**), then `Created:` / `Modified:` lines.

2. **Parse** — `parseAppleNoteMarkdown` in `src/utils/parseAppleNoteMarkdown.js` strips the title and trailing metadata and keeps the body string.

3. **Prepare body** — `prepareNoteBodyHtml` in `src/utils/parsePlainTextNoteToHtml.js` chooses:
   - **Plain text** (no HTML-like tags) → `parsePlainTextNoteToHtml`: splits on double newlines into paragraphs, groups `- ` lines into `<ul><li>`, turns single newlines inside a block into `<br>`, parses **`[label](url)`** markdown links into a single `<a>` (before raw URL linkification), then linkifies remaining bare `http(s)://` and `www.` URLs.
   - **Likely HTML** (contains tags such as `<div>`, `<p>`) → `normalizeAppleNotesHtml` (unwraps Apple-style `<div>` blocks so TipTap can parse them).

4. **Sanitize** — `sanitizeNoteHtml` (DOMPurify) removes scripts and unsafe markup while allowing semantic tags and inline `style` (for TipTap text color). Preparation runs **before** sanitization.

5. **Persistence** — `body_html` stores prepared + sanitized HTML on import and on save (`prepareNoteBodyHtml` + `sanitizeNoteHtml` on save paths that persist the body).

6. **Read mode** — `NoteBodyContent` runs `prepareNoteBodyHtml` then `sanitizeNoteHtml` so plain-text rows and legacy HTML both render with structure.

7. **Edit mode** — Same preparation before TipTap initializes. `NoteRichTextEditor` also runs `prepareNoteBodyHtml` on the initial snapshot and uses an extended **Paragraph** so inline-only `<div>` still maps to a paragraph when HTML normalization applies.

## Plain-text rules (`parsePlainTextNoteToHtml`)

- **Paragraphs**: split the body on `\n\n+`; each block is processed further.
- **Within a block**: non-list lines form one `<p>`; single newlines inside that run become `<br>`.
- **Lists**: lines matching `^\s*-\s+(.+)$` are consecutive `<li>` entries inside one `<ul>` (lists and paragraphs do not merge).
- **Links**: `[label](url)` (markdown-style) is converted to one anchor; raw URLs elsewhere are auto-linked. Order avoids double-linking or truncating URLs inside markdown syntax.
- **No flattening**: the implementation does not replace newlines with spaces or wrap the whole note in a single `<p>`.

## HTML normalization rules (`normalizeAppleNotesHtml`)

When the body is treated as HTML:

- Unwrap redundant wrappers: a `<div>` with a single block child (`<h1>`–`<h6>`, `<ul>`, `<ol>`, `<blockquote>`, `<p>`, `<pre>`, etc.) is replaced by that child.
- Hoist blocks: a `<div>` whose **element** children are all block-level is unwrapped so those blocks become direct siblings.
- Convert **leaf** `<div>` nodes (no block element children) to `<p>`, preserving inner HTML for links, bold, `<br>`, etc.

Real `<ul>`, `<ol>`, `<li>`, `<a href>`, `<blockquote>`, and headings are left intact; `class` on lists (e.g. `Apple-dash-list`) is not required for list semantics.

## Example: plain text before / after

**Before** (exported plain text):

```text
Opening line
same paragraph

Next section

- one
- two

See https://example.com
```

**After** (`parsePlainTextNoteToHtml`):

```html
<p>Opening line<br>same paragraph</p><p>Next section</p><ul><li>one</li><li>two</li></ul><p>See <a href="https://example.com" rel="noopener noreferrer">https://example.com</a></p>
```

## Known limitations

- Plain-text `*` bullets or numbered `1.` lists are not converted (only `- ` lines).
- `isLikelyHtmlString` is a lightweight heuristic (`/<[a-zA-Z][\s\S]*?>/`); if plain text literally contains something that looks like a tag, it may be routed through HTML normalization instead of plain parsing.
- HTML normalization uses the browser `DOMParser` when available; without it, HTML is returned trimmed unchanged (browser-only app is unaffected).

## Related files

| Area | File |
|------|------|
| Plain text → HTML + `prepareNoteBodyHtml` | `src/utils/parsePlainTextNoteToHtml.js` |
| Apple markdown parse | `src/utils/parseAppleNoteMarkdown.js` |
| Block / div normalization | `src/utils/normalizeAppleNotesHtml.js` |
| DOMPurify | `src/utils/sanitizeNoteHtml.js` |
| TipTap paragraph + StarterKit | `src/components/NoteRichTextEditor.jsx` |
| Read view | `src/components/NoteBodyContent.jsx` |
| Edit hydrate + save | `src/pages/NoteDetailPage.jsx`, `src/components/FloatingNewNoteComposer.jsx` |

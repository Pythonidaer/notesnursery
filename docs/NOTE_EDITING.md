# Note editing (TipTap, HTML, audio)

Notes Nursery stores the edited body as **sanitized HTML** (`body_html` when using Supabase). The note detail page uses **TipTap** (StarterKit: headings, lists, blockquote, links, etc.) with a custom **`noteAudio`** block for embedded clips.

## HTML pipeline

- **Load:** stored HTML is prepared for the editor (see `prepareNoteBodyHtml` / parsing utilities).
- **Save:** `sanitizeNoteHtml` runs on editor output before persisting.
- **Display:** read views use the same sanitization expectations as the editor output.

## Audio embeds (`noteAudio`)

- Audio is a **standalone block** in the document (a `<figure class="nn-audio-embed">` with data attributes for storage path and metadata).
- Clips are uploaded to private storage (Supabase) or chosen from the user’s previously uploaded library via **Insert audio** in the toolbar.

### Lists and audio insertion

- **Audio cannot be inserted while the cursor or selection is inside a list item** (bulleted list, numbered list, or task list item).
- **Guards run before any upload, file picker, or node insertion:** the editor is focused and the selection is checked when you click **Insert audio**, when you choose **Upload new file** (before the system file dialog), again when a file is chosen (before upload starts), and when you pick from **your library**. The insert command also refuses if the selection is still in a list.
- The app does **not** split lists, lift nodes, or auto-repair bad structure after insertion; it **blocks** the flow and shows a dialog.
- To add audio near a list, **move the caret outside the list** (for example, press Enter twice to leave the list and start a normal paragraph), then use **Insert audio** again.

### Normal paragraph / block context

- With the caret in a normal paragraph, heading, blockquote, or other non-list block context, **Insert audio** inserts the clip as usual; upload and “choose existing” behave the same.

## Related code (pointers)

- Editor setup: `src/components/NoteRichTextEditor.jsx`
- Insert flow: `src/components/InsertAudioModal.jsx`, `src/utils/insertNoteAudioBlock.js`
- Blocked-in-list dialog: `src/components/AudioInsertBlockedModal.jsx`
- Node extension: `src/tiptap/noteAudioExtension.js`

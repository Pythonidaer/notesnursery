# Voice Memos

**Voice Memos** (`/voice-memos`) lists every audio file in your private `note-audio` Storage bucket (uploads from notes, **Record**, Analysis, etc.).

## Delete behavior

Deleting a memo:

1. Removes the object from **Supabase Storage** (`storage.from('note-audio').remove`).
2. Removes the row in **`note_audio_display_names`** for that `storage_path` (if any).

It does **not** edit note HTML. Embeds store only a `storagePath` in `body_html`.

### Storage RLS required (common production issue)

If delete shows success in the UI but the file **still appears** in Voice Memos (often with a long UUID filename instead of a friendly name), Storage **DELETE** is probably blocked. Supabase may return `remove: []` with **no error**.

**Fix:** In Supabase **SQL Editor**, run:

`supabase/migrations/009_note_audio_storage_policies.sql`

That adds `SELECT` / `INSERT` / `UPDATE` / `DELETE` policies on `storage.objects` for bucket `note-audio`, scoped to `(storage.foldername(name))[1] = auth.uid()`.

After running the migration, delete again. The list refreshes from Storage after a successful delete.

If a friendly display name disappears but the file remains, only `note_audio_display_names` was cleared earlier — run the migration and delete again to remove the Storage object.

## Notes that still embed deleted audio

When a clip is deleted from Voice Memos but the note still contains a `noteAudio` embed:

1. The app requests a signed URL for the old path.
2. Storage returns “not found”.
3. The embed shows **Audio unavailable** (muted text, same tone as “Loading…”) — not a red error.

To fully clean up a note, open it in edit mode and remove the embed (gear → remove from note), or delete the broken block manually.

### Note usage before delete

Each row shows how many of your notes embed that file’s `storagePath` (e.g. **In 3 notes** or **Not in any notes**). The info modal includes the same line under **In notes**. The delete confirmation adds **Used in N note(s).** when N > 0.

Counts scan `body_html` for `figure.nn-audio-embed` with a matching `data-nn-storage-path` (same rule as Analysis WPM). Markdown-only bodies without HTML embeds are not counted.

### Future options (not implemented)

- Background scan of `body_html` for deleted paths and strip embeds.
- Link from Voice Memos to note titles that embed a clip.
- Orphan report in Voice Memos.

## Related code

- Page: `src/pages/VoiceMemosPage.jsx`
- Delete: `src/lib/noteAudioDelete.js`
- List: `src/lib/noteAudioList.js`
- Playback: `src/lib/noteAudioSignedUrl.js`, `src/lib/noteAudioPlaybackErrors.js`
- Embed usage counts: `src/utils/noteAudioEmbedUsage.js` (uses `noteHtmlReferencesAudioStoragePath` from `analysisWpmFromNoteHtml.js`)

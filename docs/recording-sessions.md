# Recording Sessions

Browser-recorded audio is **separate from notes**. A session is saved as a private Storage asset first; you attach it to a note later with **Insert audio → your library** (same flow as uploaded `.wav` / `.mp3` files).

## MP3 on upload (preview stays native)

| Phase | Format |
|-------|--------|
| While recording / local draft | Browser-native (`.m4a` on iOS, `.webm` on Chrome, etc.) |
| Preview before upload | Same native blob (IndexedDB) |
| **Upload / Save** | Converted to **`.mp3`** (`audio/mpeg`) in the browser, then sent to Supabase |

Conversion uses the **Web Audio API** (`decodeAudioData`) plus **LAME** (`@breezystack/lamejs`, 128 kbps). Code: `src/lib/audio/convertRecordingToMp3.js`.

Your Supabase **`note-audio`** bucket only needs **`audio/mpeg`** (and optional `audio/wav` for manual uploads) — you do **not** need to allow `audio/webm` on the bucket for recordings.

**Limits:** Very long clips use more RAM during decode/encode. The same per-file size cap applies after conversion. If conversion fails, the local draft is kept and you can retry or discard.

### Future: server-side transcoding (optional)

For very large files or lower client CPU use, a backend **ffmpeg** Edge Function could replace in-browser encoding.

## MIME selection order

The app avoids WebM on **iOS / Safari** (preview and older buckets often break). Preference order:

**Apple (iOS Safari, iOS Chrome, desktop Safari):**

1. `audio/mp4;codecs=mp4a`
2. `audio/mp4`
3. `audio/wav`

**Other browsers (e.g. desktop Chrome):**

1. `audio/mp4` / `audio/mp4;codecs=mp4a` (when supported)
2. `audio/wav`
3. `audio/webm;codecs=opus`
4. `audio/webm`

## Architecture

| Layer | Module | Role |
|-------|--------|------|
| Page | `src/pages/RecordingsPage.jsx` | Auth gate, drafts, upload |
| Hook | `src/hooks/useAudioRecorder.js` | `MediaRecorder`, IndexedDB chunks |
| MIME | `src/lib/audio/recordingMimeTypes.js` | Platform-aware `isTypeSupported` |
| Convert | `src/lib/audio/convertRecordingToMp3.js` | Native blob → MP3 before upload |
| Upload | `src/lib/audio/uploadRecording.js` | MP3 upload + display names |
| Local | `src/lib/audio/recordingDraftDb.js` | IndexedDB drafts |

Storage path: `{userId}/recordings/{uuid}_{safeFileName}`.

## Why recordings are not notes

- No half-finished embeds in `body_html`.
- Same asset can be reused in multiple notes.
- Matches “upload first, embed later” for file uploads.

## IndexedDB local recovery

Chunks are written during recording. Drafts survive refresh until upload succeeds or you **Discard**.

## Route

- **`/recordings`** — header nav **Record** (production + sign-in). A separate library/manage page may be added later.

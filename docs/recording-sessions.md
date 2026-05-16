# Recording Sessions

Browser-recorded audio is **separate from notes**. A session is saved as a private Storage asset first; you attach it to a note later with the same **Insert audio → your library** flow used for uploaded `.wav` / `.mp3` files.

## Architecture

| Layer | Module | Role |
|-------|--------|------|
| Page | `src/pages/RecordingsPage.jsx` | Auth gate, drafts list, upload orchestration, online/offline |
| UI | `src/components/audio/RecordingControls.jsx` | Start / pause / resume / stop |
| UI | `src/components/audio/RecordingDraftList.jsx` | Preview, display name, upload / retry / discard |
| Hook | `src/hooks/useAudioRecorder.js` | `MediaRecorder`, mic permission, chunk persistence |
| MIME | `src/lib/audio/recordingMimeTypes.js` | `isTypeSupported` preference order, filenames |
| Local | `src/lib/audio/recordingDraftDb.js` | IndexedDB drafts (`notesnursery-recording-drafts`) |
| Upload | `src/lib/audio/uploadRecording.js` | `uploadNoteAudioFile` + `note_audio_display_names` |
| Library | `src/lib/noteAudioList.js` | Lists webm / m4a / mp4 alongside wav / mp3 |

Storage path: `{userId}/recordings/{uuid}_{safeFileName}` (scope constant `RECORDINGS_AUDIO_SCOPE`).

## Why recordings are not notes

- Avoids half-finished embeds in `body_html`.
- Same asset can be reused in multiple notes.
- Matches “upload first, embed later” for file uploads.

## Browser recording (no MP3 in MVP)

Browsers do **not** reliably record directly to MP3. The app picks the first supported type in this order:

1. `audio/webm;codecs=opus`
2. `audio/webm`
3. `audio/mp4`
4. `audio/mp4;codecs=mp4a`
5. `audio/wav`

Files are stored in native format (e.g. `.webm`, `.m4a`). Playback in notes uses the HTML `<audio>` element and signed URLs.

### Future MP3 transcoding (TODO)

- Backend **ffmpeg** job after upload (recommended for mobile).
- Server-side conversion on Storage webhook.
- **ffmpeg.wasm** is possible client-side but heavy on phones; treat as experimental.

### Future transcription (TODO)

- Reuse the same Storage path; run STT on uploaded blob (Edge Function or batch job).
- Transcript text would be inserted into a note separately, not auto-created on record stop.

## Mobile / iOS caveats

- **iOS Chrome** uses WebKit — test Safari behavior first.
- **Pause/resume** depends on `MediaRecorder.pause`; some iOS versions omit it (UI hides Pause when unsupported).
- Request microphone access **only** when the user taps **Start recording**.
- Use large tap targets; no hover-only controls.
- Denied permission, missing mic, or missing `MediaRecorder` show explicit errors.

## IndexedDB local recovery

While recording, `dataavailable` chunks are appended to IndexedDB (not `localStorage`). Draft fields include `draftId`, `userId`, `startedAt`, `updatedAt`, `duration`, `mimeType`, `extension`, `status`, optional `displayName`, and `chunks`.

Statuses: `recording`, `paused`, `stopped-local`, `upload-pending`, `uploading`, `uploaded`, `failed`, `discarded`.

- Refresh during/after record: drafts reload on `/recordings`.
- Local draft is removed **only** after a successful Supabase upload or explicit **Discard**.
- Upload failure sets `failed` and keeps chunks.

## Supabase upload flow

1. User stops → blob assembled from chunks → preview locally.
2. **Upload / Save** → `uploadNoteAudioFile` → optional `upsertNoteAudioDisplayName`.
3. `listUserNoteAudioFiles` includes new extensions; **Insert audio** in the note editor lists the file.

## Offline behavior

- `navigator.onLine` + `online` / `offline` events update UI.
- Stop while offline → `upload-pending`.
- **Retry upload** when back online (manual; local copy always kept until success).

## Testing checklist

See acceptance tests in the product handoff:

- Desktop Chrome: record → pause → resume → stop → preview → upload.
- Desktop Safari when available.
- iPhone Safari / Chrome: permission, record, pause if supported, stop, upload.
- Offline: record, disconnect, stop, reconnect, retry upload.
- Refresh: stop before upload, refresh, draft still present.
- Failure: force upload error, local draft preserved.
- Note integration: upload → note editor → Insert audio → select → embed → playback.

## Route

- **`/recordings`** — header nav **Recordings** (production + sign-in).

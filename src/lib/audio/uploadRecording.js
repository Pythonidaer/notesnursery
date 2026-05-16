import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../../constants/noteAudio.js';
import { uploadNoteAudioFile } from '../noteAudioUpload.js';
import { upsertNoteAudioDisplayName } from '../noteAudioDisplayNames.js';
import { buildRecordingFileName } from './recordingMimeTypes.js';
import { recordingDraftToBlob } from './recordingDraftDb.js';

/** Storage folder key for browser recordings (see `buildNoteAudioObjectPath`). */
export const RECORDINGS_AUDIO_SCOPE = 'recordings';

/**
 * @param {string} userId
 * @param {import('./recordingDraftDb.js').RecordingDraft} draft
 * @returns {Promise<{ path: string, fileName: string, mimeType: string, sizeBytes: number }>}
 */
export async function uploadRecordingDraft(userId, draft) {
  const blob = recordingDraftToBlob(draft);
  if (blob.size > NOTE_AUDIO_MAX_UPLOAD_BYTES) {
    throw new Error(
      `Recording (${Math.round(blob.size / 1024 / 1024)} MB) exceeds the upload limit.`
    );
  }
  const fileName = buildRecordingFileName(draft.startedAt, draft.extension);
  const file = new File([blob], fileName, {
    type: draft.mimeType || blob.type || 'application/octet-stream',
  });
  const uploaded = await uploadNoteAudioFile(userId, RECORDINGS_AUDIO_SCOPE, file);
  const label = (draft.displayName && draft.displayName.trim()) || fileName;
  const rec = await upsertNoteAudioDisplayName(userId, uploaded.path, label);
  if (!rec.ok) {
    console.error('[recording] display name', rec.error);
  }
  return uploaded;
}

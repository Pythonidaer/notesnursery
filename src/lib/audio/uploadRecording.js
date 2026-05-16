import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../../constants/noteAudio.js';
import { uploadNoteAudioFile } from '../noteAudioUpload.js';
import { upsertNoteAudioDisplayName } from '../noteAudioDisplayNames.js';
import { convertRecordingBlobToMp3 } from './convertRecordingToMp3.js';
import { formatStorageMimeRejectedMessage } from './noteAudioStoragePolicy.js';
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
  const sourceBlob = recordingDraftToBlob(draft);
  if (sourceBlob.size > NOTE_AUDIO_MAX_UPLOAD_BYTES) {
    throw new Error(
      `Recording (${Math.round(sourceBlob.size / 1024 / 1024)} MB) exceeds the upload limit.`
    );
  }

  const mp3Blob = await convertRecordingBlobToMp3(sourceBlob);
  if (mp3Blob.size > NOTE_AUDIO_MAX_UPLOAD_BYTES) {
    throw new Error(
      `MP3 (${Math.round(mp3Blob.size / 1024 / 1024)} MB) exceeds the upload limit after conversion.`
    );
  }

  const fileName = buildRecordingFileName(draft.startedAt, 'mp3');
  const file = new File([mp3Blob], fileName, { type: 'audio/mpeg' });

  let uploaded;
  try {
    uploaded = await uploadNoteAudioFile(userId, RECORDINGS_AUDIO_SCOPE, file);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    throw new Error(formatStorageMimeRejectedMessage(raw));
  }

  const label = (draft.displayName && draft.displayName.trim()) || fileName.replace(/\.mp3$/i, '');
  const rec = await upsertNoteAudioDisplayName(userId, uploaded.path, label);
  if (!rec.ok) {
    console.error('[recording] display name', rec.error);
  }
  return uploaded;
}

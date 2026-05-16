/**
 * @param {import('./recordingDraftDb.js').RecordingDraftStatus} status
 * @param {{ online: boolean, uploadError?: string | null }} ctx
 */
export function recordingDraftStatusMessage(status, ctx) {
  switch (status) {
    case 'recording':
      return 'Recording locally';
    case 'paused':
      return 'Paused — saved locally';
    case 'stopped-local':
      return 'Saved locally';
    case 'upload-pending':
      return ctx.online ? 'Ready to upload' : 'Upload pending — offline';
    case 'uploading':
      return 'Uploading…';
    case 'uploaded':
      return 'Uploaded successfully';
    case 'failed':
      return ctx.uploadError
        ? `Upload failed — local copy preserved (${ctx.uploadError})`
        : 'Upload failed — local copy preserved';
    default:
      return '';
  }
}

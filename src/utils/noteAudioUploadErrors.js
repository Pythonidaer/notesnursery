import { formatBytes } from './formatBytes.js';

/**
 * @param {unknown} err
 * @param {{ fileName: string, fileSizeBytes: number, maxBytes: number }} ctx
 * @returns {{ reason: string, isLikelySizeLimit: boolean }}
 */
export function describeNoteAudioUploadFailure(err, ctx) {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  const isLikelySizeLimit =
    ctx.fileSizeBytes > ctx.maxBytes ||
    /413|payload too large|too large|maximum|size limit|entity too large|request entity/i.test(raw + lower);

  let reason = raw || 'Upload failed';
  if (isLikelySizeLimit && ctx.fileSizeBytes > ctx.maxBytes) {
    reason = `This file (${formatBytes(ctx.fileSizeBytes)}) exceeds the current upload limit (${formatBytes(ctx.maxBytes)}).`;
  } else if (isLikelySizeLimit) {
    reason = `The upload was rejected (often due to file size). ${raw ? `Details: ${raw}` : ''}`.trim();
  }

  return { reason, isLikelySizeLimit };
}

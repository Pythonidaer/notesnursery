/** @typedef {import('./recordingDraftDb.js').RecordingDraft} RecordingDraft */

/** Drafts the user must upload or discard before starting a new recording. */
export const REVIEW_DRAFT_STATUSES = /** @type {const} */ ([
  'stopped-local',
  'upload-pending',
  'uploading',
  'failed',
]);

/**
 * @param {RecordingDraft | { status: string }} draft
 */
export function isReviewDraft(draft) {
  return /** @type {readonly string[]} */ (REVIEW_DRAFT_STATUSES).includes(draft.status);
}

/**
 * Newest review draft (expects `updatedAt` desc sort from listRecordingDraftsForUser).
 * @param {RecordingDraft[]} drafts
 * @returns {RecordingDraft | null}
 */
export function pickPrimaryReviewDraft(drafts) {
  return drafts.find(isReviewDraft) ?? null;
}

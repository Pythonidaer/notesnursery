import { describe, expect, it } from 'vitest';
import { isReviewDraft, pickPrimaryReviewDraft } from './recordingDraftReview.js';

describe('recordingDraftReview', () => {
  it('identifies drafts awaiting upload or discard', () => {
    expect(isReviewDraft({ status: 'stopped-local' })).toBe(true);
    expect(isReviewDraft({ status: 'recording' })).toBe(false);
  });

  it('picks the newest review draft', () => {
    const drafts = [
      { draftId: 'b', status: 'stopped-local', updatedAt: '2026-01-03' },
      { draftId: 'a', status: 'stopped-local', updatedAt: '2026-01-02' },
    ];
    expect(pickPrimaryReviewDraft(drafts)?.draftId).toBe('b');
  });
});

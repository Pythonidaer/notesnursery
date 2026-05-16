import { describe, expect, it } from 'vitest';
import { concatArrayBuffers, normalizeRecordingMimeType } from './recordingDraftDb.js';

describe('concatArrayBuffers', () => {
  it('merges two buffers', () => {
    const a = new Uint8Array([1, 2]).buffer;
    const b = new Uint8Array([3]).buffer;
    const out = new Uint8Array(concatArrayBuffers(a, b));
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
});

describe('normalizeRecordingMimeType', () => {
  it('strips codec suffix for Safari', () => {
    expect(normalizeRecordingMimeType('audio/mp4;codecs=mp4a')).toBe('audio/mp4');
  });
});

import { describe, expect, it } from 'vitest';
import { buildRecordingFileName } from './recordingMimeTypes.js';

describe('buildRecordingFileName', () => {
  it('formats timestamp and extension without spaces', () => {
    const name = buildRecordingFileName(new Date('2026-05-16T14:05:09Z'), 'webm');
    expect(name).toMatch(/^recording-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.webm$/);
    expect(name).not.toContain(' ');
  });

  it('uses m4a for mp4 codec recordings', () => {
    const name = buildRecordingFileName('2026-01-02T03:04:05.000Z', 'm4a');
    expect(name.endsWith('.m4a')).toBe(true);
  });
});

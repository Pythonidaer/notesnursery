import { describe, expect, it } from 'vitest';
import { formatAudioDuration } from './formatAudioDuration.js';

describe('formatAudioDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatAudioDuration(125)).toBe('2:05');
  });

  it('returns em dash for invalid input', () => {
    expect(formatAudioDuration(null)).toBe('—');
  });
});

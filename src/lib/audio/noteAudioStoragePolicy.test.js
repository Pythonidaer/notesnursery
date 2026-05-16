import { describe, expect, it } from 'vitest';
import { resolveStorageContentType } from './noteAudioStoragePolicy.js';

describe('resolveStorageContentType', () => {
  it('maps mp3 extension to audio/mpeg', () => {
    expect(resolveStorageContentType('mp3', '')).toBe('audio/mpeg');
  });

  it('maps wav extension to audio/wav', () => {
    expect(resolveStorageContentType('wav', 'audio/webm')).toBe('audio/wav');
  });
});

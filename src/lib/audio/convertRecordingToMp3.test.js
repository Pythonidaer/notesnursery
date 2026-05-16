import { describe, expect, it } from 'vitest';
import { float32ToInt16Pcm } from './convertRecordingToMp3.js';

describe('float32ToInt16Pcm', () => {
  it('clamps and scales float samples to 16-bit PCM', () => {
    const pcm = float32ToInt16Pcm(new Float32Array([0, 1, -1, 2]));
    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(0x7fff);
    expect(pcm[2]).toBe(-0x8000);
    expect(pcm[3]).toBe(0x7fff);
  });
});

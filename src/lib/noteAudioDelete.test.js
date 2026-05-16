import { describe, expect, it } from 'vitest';
import { assertUserOwnsStoragePath } from './noteAudioDelete.js';

describe('assertUserOwnsStoragePath', () => {
  it('accepts paths under the user prefix', () => {
    expect(assertUserOwnsStoragePath('user-1', 'user-1/recordings/x.mp3')).toBe(
      'user-1/recordings/x.mp3'
    );
  });

  it('rejects paths outside the user prefix', () => {
    expect(() => assertUserOwnsStoragePath('user-1', 'user-2/x.mp3')).toThrow(/your own/);
  });
});

// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
  buildAudioPathNoteUsageMap,
  countNotesReferencingAudioPath,
  formatVoiceMemoNoteUsage,
} from './noteAudioEmbedUsage.js';

const PATH_A = 'user-1/clip-a.mp3';
const PATH_B = 'user-1/clip-b.mp3';

const embed = (path) =>
  `<p>Hello</p><figure class="nn-audio-embed" data-nn-storage-path="${path}"></figure>`;

const notes = [
  { id: 'n1', bodyHtml: embed(PATH_A) },
  { id: 'n2', bodyHtml: embed(PATH_A) + embed(PATH_B) },
  { id: 'n3', bodyHtml: '<p>No audio</p>' },
  { id: 'n4', bodyHtml: embed(PATH_B) },
];

describe('countNotesReferencingAudioPath', () => {
  it('counts notes with a matching embed path', () => {
    expect(countNotesReferencingAudioPath(notes, PATH_A)).toBe(2);
    expect(countNotesReferencingAudioPath(notes, PATH_B)).toBe(2);
  });

  it('returns 0 when no notes or path match', () => {
    expect(countNotesReferencingAudioPath(notes, 'user-1/missing.mp3')).toBe(0);
    expect(countNotesReferencingAudioPath([], PATH_A)).toBe(0);
    expect(countNotesReferencingAudioPath(notes, '')).toBe(0);
  });
});

describe('buildAudioPathNoteUsageMap', () => {
  it('builds count and noteIds per storage path', () => {
    const map = buildAudioPathNoteUsageMap(notes, [PATH_A, PATH_B, 'user-1/missing.mp3']);
    expect(map[PATH_A]).toEqual({ count: 2, noteIds: ['n1', 'n2'] });
    expect(map[PATH_B]).toEqual({ count: 2, noteIds: ['n2', 'n4'] });
    expect(map['user-1/missing.mp3']).toEqual({ count: 0, noteIds: [] });
  });

  it('returns empty usage for paths when there are no notes', () => {
    expect(buildAudioPathNoteUsageMap([], [PATH_A])[PATH_A]).toEqual({ count: 0, noteIds: [] });
  });
});

describe('formatVoiceMemoNoteUsage', () => {
  it('formats zero, one, and many', () => {
    expect(formatVoiceMemoNoteUsage(0)).toBe('Not in any notes');
    expect(formatVoiceMemoNoteUsage(1)).toBe('In 1 note');
    expect(formatVoiceMemoNoteUsage(3)).toBe('In 3 notes');
  });
});

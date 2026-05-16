import { describe, expect, it } from 'vitest';
import { loginRedirectStateFromLocation, safeAuthReturnPath } from './authReturnPath.js';

describe('safeAuthReturnPath', () => {
  it('returns the requested in-app path', () => {
    expect(safeAuthReturnPath('/voice-memos')).toBe('/voice-memos');
  });

  it('falls back for auth routes', () => {
    expect(safeAuthReturnPath('/login')).toBe('/library');
  });
});

describe('loginRedirectStateFromLocation', () => {
  it('preserves pathname and search', () => {
    expect(loginRedirectStateFromLocation({ pathname: '/voice-memos', search: '' })).toEqual({
      from: '/voice-memos',
    });
  });
});

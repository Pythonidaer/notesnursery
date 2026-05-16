import { describe, expect, it, vi } from 'vitest';
import {
  hasAuthStorageToken,
  logAuthStoragePresence,
  subscribeToAuthSession,
} from './authSessionBootstrap.js';

describe('subscribeToAuthSession', () => {
  it('does not call onReady until the first auth event', () => {
    let listener = null;
    const supabase = {
      auth: {
        onAuthStateChange: (cb) => {
          listener = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      },
    };
    const onSession = vi.fn();
    const onReady = vi.fn();

    subscribeToAuthSession(supabase, { onSession, onReady, logEvents: false });

    expect(onReady).not.toHaveBeenCalled();
    expect(onSession).not.toHaveBeenCalled();
  });

  it('restores session when INITIAL_SESSION fires after a delayed null getSession would have settled', () => {
    let listener = null;
    const supabase = {
      auth: {
        onAuthStateChange: (cb) => {
          listener = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      },
    };
    const sessions = [];
    const onSession = vi.fn((s) => sessions.push(s));
    const onReady = vi.fn();

    subscribeToAuthSession(supabase, { onSession, onReady, logEvents: false });

    const restored = { user: { id: 'user-1' }, access_token: 'at' };
    listener('INITIAL_SESSION', restored);

    expect(onSession).toHaveBeenCalledWith(restored);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(sessions.at(-1)?.user?.id).toBe('user-1');
  });

  it('calls onReady only once across multiple auth events', () => {
    let listener = null;
    const supabase = {
      auth: {
        onAuthStateChange: (cb) => {
          listener = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      },
    };
    const onReady = vi.fn();

    subscribeToAuthSession(supabase, {
      onSession: () => {},
      onReady,
      logEvents: false,
    });

    listener('INITIAL_SESSION', { user: { id: 'a' } });
    listener('TOKEN_REFRESHED', { user: { id: 'a' } });
    listener('SIGNED_OUT', null);

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('defers onReady when INITIAL_SESSION is null but auth token exists in storage', () => {
    vi.useFakeTimers();
    const url = 'https://abcdefgh.supabase.co';
    const key = 'sb-abcdefgh-auth-token';
    const storage = { [key]: '{"access_token":"x"}' };
    vi.stubGlobal('localStorage', {
      getItem: (k) => storage[k] ?? null,
    });

    let listener = null;
    const supabase = {
      auth: {
        onAuthStateChange: (cb) => {
          listener = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      },
    };
    const onReady = vi.fn();

    subscribeToAuthSession(supabase, {
      onSession: () => {},
      onReady,
      supabaseUrl: url,
      restoreWaitMs: 5000,
    });

    listener('INITIAL_SESSION', null);
    expect(onReady).not.toHaveBeenCalled();

    const restored = { user: { id: 'user-1' }, access_token: 'at' };
    listener('TOKEN_REFRESHED', restored);
    expect(onReady).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('unsubscribes when the returned cleanup runs', () => {
    const unsubscribe = vi.fn();
    const supabase = {
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe } },
        }),
      },
    };

    const cleanup = subscribeToAuthSession(supabase, {
      onSession: () => {},
      onReady: () => {},
      logEvents: false,
    });
    cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('hasAuthStorageToken', () => {
  it('returns true when the Supabase auth key is present', () => {
    const url = 'https://abcdefgh.supabase.co';
    vi.stubGlobal('localStorage', {
      getItem: (k) => (k === 'sb-abcdefgh-auth-token' ? '{}' : null),
    });
    expect(hasAuthStorageToken(url)).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('logAuthStoragePresence', () => {
  it('does not throw when localStorage is unavailable', () => {
    expect(() => logAuthStoragePresence('https://abcdefgh.supabase.co')).not.toThrow();
  });
});

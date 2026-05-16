import { describe, expect, it, vi } from 'vitest';
import { logAuthStoragePresence, subscribeToAuthSession } from './authSessionBootstrap.js';

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

describe('logAuthStoragePresence', () => {
  it('does not throw when localStorage is unavailable', () => {
    expect(() => logAuthStoragePresence('https://abcdefgh.supabase.co')).not.toThrow();
  });
});

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getSupabase } from '../lib/supabaseClient.js';
import styles from './LoginPage.module.css';

/** Parse Supabase auth errors from the URL fragment or query string after a redirect. */
function readAuthUrlError() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    const p = new URLSearchParams(hash);
    const desc = p.get('error_description');
    if (desc) return decodeURIComponent(desc.replace(/\+/g, ' '));
    const err = p.get('error');
    if (err) return decodeURIComponent(err.replace(/\+/g, ' '));
  }
  const q = new URLSearchParams(window.location.search);
  const qDesc = q.get('error_description');
  if (qDesc) return decodeURIComponent(qDesc.replace(/\+/g, ' '));
  const qErr = q.get('error');
  if (qErr) return decodeURIComponent(qErr.replace(/\+/g, ' '));
  return null;
}

export default function EmailConfirmedPage() {
  const navigate = useNavigate();
  const backend = useSupabaseBackend();
  const { user, authInitializing } = useAuth();
  const [phase, setPhase] = useState(/** @type {'loading' | 'success' | 'error' | 'unknown'} */ ('loading'));
  const [urlError, setUrlError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!backend) {
      setPhase('unknown');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setPhase('unknown');
      return;
    }

    const fromUrl = readAuthUrlError();
    if (fromUrl) {
      setUrlError(fromUrl);
      setPhase('error');
      return;
    }

    if (authInitializing) {
      setPhase('loading');
      return;
    }

    if (user) {
      setPhase('success');
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        setPhase('success');
        return;
      }
      setPhase('unknown');
    });

    return () => {
      cancelled = true;
    };
  }, [authInitializing, backend, user]);

  useEffect(() => {
    if (!backend) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setPhase('success');
    });
    return () => subscription.unsubscribe();
  }, [backend]);

  const goLogin = () => {
    navigate('/login', { replace: true });
  };

  const goLibrary = () => {
    navigate('/library', { replace: true });
  };

  if (!backend) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Email confirmation</h1>
        <p className={styles.lead}>Supabase is not enabled in this build.</p>
        <Link to="/login" className={styles.inlineLink}>
          Log in
        </Link>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Confirming your email</h1>
        <p className={styles.lead}>One moment while we finish signing you in from the link…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Link problem</h1>
        <p className={styles.error}>{urlError ?? 'This confirmation link could not be used.'}</p>
        <p className={styles.lead}>Request a new confirmation email from the sign-up flow, or try logging in if you already verified.</p>
        <button type="button" className={styles.primaryBtn} onClick={goLogin}>
          Continue to log in
        </button>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Email confirmed</h1>
        <p className={styles.lead}>Your email is verified and you are now signed in.</p>
        <button type="button" className={styles.primaryBtn} onClick={goLibrary}>
          Continue
        </button>
        <p className={styles.footer}>
          <Link to="/library" className={styles.back}>
            ← Back to library
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Almost there</h1>
      <p className={styles.lead}>
        We could not detect a new session from this page. If you already clicked the confirmation link, try logging in. If
        the link expired, sign up again or use password recovery from Supabase if enabled.
      </p>
      <button type="button" className={styles.primaryBtn} onClick={goLogin}>
        Continue to log in
      </button>
      <p className={styles.footer}>
        <Link to="/signup" className={styles.inlineLink}>
          Sign up
        </Link>
      </p>
    </div>
  );
}

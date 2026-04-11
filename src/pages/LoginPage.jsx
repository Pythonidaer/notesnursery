import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, authError, setAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(/** @type {string | null} */ (null));

  const backend = useSupabaseBackend();

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setAuthError(null);
    if (!backend) {
      setFormError('Supabase is not configured. Use local mode (see README).');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) return;

    navigate('/library', { replace: true });
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Log in</h1>
      <p className={styles.lead}>
        {backend
          ? 'Use your email and password. New here? Create an account first.'
          : 'Supabase auth is disabled in this build (local mode or missing env vars).'}
      </p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {formError ? <p className={styles.error}>{formError}</p> : null}
        {authError ? <p className={styles.error}>{authError}</p> : null}
        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>
      <p className={styles.footer}>
        <span className={styles.cta}>New here?</span>{' '}
        <Link to="/signup" className={styles.inlineLink}>
          Create an account
        </Link>
      </p>
      <Link to="/library" className={styles.back}>
        ← Back to library
      </Link>
    </div>
  );
}

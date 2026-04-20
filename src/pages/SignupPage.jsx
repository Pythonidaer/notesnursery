import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import styles from './LoginPage.module.css';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp, authError, setAuthError } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(/** @type {string | null} */ (null));

  const backend = useSupabaseBackend();

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setAuthError(null);
    if (!username.trim()) {
      setFormError('Please choose a username.');
      return;
    }
    if (!backend) {
      setFormError('Supabase is not configured. Use local mode (see README).');
      return;
    }
    setLoading(true);
    const { error, sessionCreated } = await signUp({
      email,
      password,
      username: username.trim(),
    });
    setLoading(false);
    if (error) return;
    if (!sessionCreated) {
      setFormError('Account was created, but automatic sign-in did not complete. Please log in.');
      return;
    }
    navigate('/library', { replace: true });
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Create account</h1>
      <p className={styles.lead}>
        {backend
          ? 'Pick a username and sign up with email + password to start using your account right away.'
          : 'Supabase auth is disabled in this build (local mode or missing env vars).'}
      </p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
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
            autoComplete="new-password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        {formError ? <p className={styles.error}>{formError}</p> : null}
        {authError ? <p className={styles.error}>{authError}</p> : null}
        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className={styles.footer}>
        Already have an account?{' '}
        <Link to="/login" className={styles.inlineLink}>
          Log in
        </Link>
      </p>
      <Link to="/library" className={styles.back}>
        ← Back to library
      </Link>
    </div>
  );
}

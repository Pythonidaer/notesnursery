import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseBackend } from '../config/appConfig.js';
import styles from './LoginPage.module.css';

export default function CheckEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const backend = useSupabaseBackend();
  const email = typeof location.state?.email === 'string' ? location.state.email.trim() : '';
  const sessionCreated = location.state?.sessionCreated === true;

  if (!backend) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.lead}>Supabase is not enabled in this build.</p>
        <Link to="/signup" className={styles.inlineLink}>
          Back to sign up
        </Link>
      </div>
    );
  }

  if (!email) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.lead}>
          If you just created an account, open the link we sent to confirm your email, then sign in here.
        </p>
        <button type="button" className={styles.primaryBtn} onClick={() => navigate('/signup', { replace: true })}>
          Back to sign up
        </button>
        <p className={styles.footer}>
          Already confirmed?{' '}
          <Link to="/login" className={styles.inlineLink}>
            Log in
          </Link>
        </p>
      </div>
    );
  }

  if (sessionCreated) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Account created</h1>
        <p className={styles.lead}>
          You are signed in as <strong className={styles.emailEmphasis}>{email}</strong>. Your Supabase project has{' '}
          <strong>email confirmation turned off</strong> (typical for local development), so no verification email was
          sent and you can use the app right away.
        </p>
        <p className={styles.hint}>
          In production, turn on “Confirm email” in Supabase Authentication if you want the check-your-email and
          verification link flow.
        </p>
        <button type="button" className={styles.primaryBtn} onClick={() => navigate('/library', { replace: true })}>
          Go to library
        </button>
        <p className={styles.footer}>
          <Link to="/login" className={styles.inlineLink}>
            Log in on another device
          </Link>
          {' · '}
          <Link to="/signup" className={styles.inlineLink}>
            Sign up form
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Check your email</h1>
      <p className={styles.lead}>
        We sent a verification link to <strong className={styles.emailEmphasis}>{email}</strong>.
      </p>
      <ul className={styles.stepsList}>
        <li>Open the email and click the confirmation link.</li>
        <li>You must confirm your email before you can log in.</li>
        <li>After confirming, use the button on the next screen to go to log in, then sign in with your password.</li>
      </ul>
      <p className={styles.hint}>Did not get an email? Check spam or promotions, then wait a minute and try again.</p>
      <p className={styles.footer}>
        <Link to="/login" className={styles.inlineLink}>
          Return to log in
        </Link>
        {' · '}
        <Link to="/signup" className={styles.inlineLink}>
          Sign up form
        </Link>
      </p>
      <Link to="/library" className={styles.back}>
        ← Back to library
      </Link>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppHeaderNav() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const remote = useSupabaseBackend();

  const handleSignOut = async () => {
    await signOut();
    if (remote) {
      navigate('/login', { replace: true });
    } else {
      navigate('/library', { replace: true });
    }
  };

  if (!remote) {
    return (
      <nav className="appNav" aria-label="Account">
        <Link to="/library" className="appNavLink">
          Library
        </Link>
        <span className="appNavHint">Local</span>
      </nav>
    );
  }

  if (user) {
    return (
      <nav className="appNav" aria-label="Account">
        <Link to="/library" className="appNavLink">
          Library
        </Link>
        <span className="appNavHint" title={user.email ?? ''}>
          {user.email}
        </span>
        <button type="button" className="appNavBtn" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </nav>
    );
  }

  return (
    <nav className="appNav" aria-label="Account">
      <Link to="/library" className="appNavLink">
        Library
      </Link>
      <Link to="/login" className="appNavLink">
        Log in
      </Link>
      <Link to="/signup" className="appNavLink">
        Sign up
      </Link>
    </nav>
  );
}

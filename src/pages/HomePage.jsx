import { Navigate } from 'react-router-dom';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import ImportPage from './ImportPage.jsx';

/**
 * `/` — Import UI for local mode and logged-out users.
 * In production with Supabase: logged-in users with notes redirect to Library; others stay on Import.
 */
export default function HomePage() {
  const remote = useSupabaseBackend();
  const { user, authInitializing } = useAuth();
  const { notes, noteListReady } = useNotes();

  if (!remote) {
    return <ImportPage />;
  }

  if (authInitializing) {
    return <ImportPage />;
  }

  if (!user) {
    return <ImportPage />;
  }

  if (!noteListReady) {
    return <p className="homeGateLoading">Loading your notes…</p>;
  }

  if (notes.length > 0) {
    return <Navigate to="/library" replace />;
  }

  return <ImportPage />;
}

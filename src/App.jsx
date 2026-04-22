import { useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import AppHeaderNav from './components/AppHeaderNav.jsx';
import HomePage from './pages/HomePage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import CardsPage from './pages/CardsPage.jsx';
import InstructionsPage from './pages/InstructionsPage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import EmailConfirmedPage from './pages/EmailConfirmedPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NoteDetailPage from './pages/NoteDetailPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import SignupPage from './pages/SignupPage.jsx';

/**
 * Once the user opens Analysis, keep that route subtree mounted and toggle visibility
 * with the `hidden` attribute so WaveSurfer is not destroyed when navigating away and back.
 */
export default function App() {
  const { pathname } = useLocation();
  const analysisPinnedRef = useRef(pathname === '/analysis');
  if (pathname === '/analysis') {
    analysisPinnedRef.current = true;
  }
  const analysisPinned = analysisPinnedRef.current;

  return (
    <div className="appShell">
      <header className="appHeader">
        <Link to="/" className="appBrand">
          Notes Nursery
        </Link>
        <AppHeaderNav />
      </header>
      <main className="appMain">
        {analysisPinned ? (
          <div hidden={pathname !== '/analysis'} className="analysisKeepAliveHost">
            <AnalysisPage />
          </div>
        ) : null}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
          <Route path="/analysis" element={analysisPinned ? null : <AnalysisPage />} />
          <Route path="/notes/:noteId" element={<NoteDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/email-confirmed" element={<EmailConfirmedPage />} />
        </Routes>
      </main>
    </div>
  );
}

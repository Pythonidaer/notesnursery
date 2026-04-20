import { Routes, Route, Link } from 'react-router-dom';
import AppHeaderNav from './components/AppHeaderNav.jsx';
import HomePage from './pages/HomePage.jsx';
import CardsPage from './pages/CardsPage.jsx';
import InstructionsPage from './pages/InstructionsPage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import EmailConfirmedPage from './pages/EmailConfirmedPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NoteDetailPage from './pages/NoteDetailPage.jsx';
import SignupPage from './pages/SignupPage.jsx';

export default function App() {
  return (
    <div className="appShell">
      <header className="appHeader">
        <Link to="/" className="appBrand">
          Notes Nursery
        </Link>
        <AppHeaderNav />
      </header>
      <main className="appMain">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
          <Route path="/notes/:noteId" element={<NoteDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/email-confirmed" element={<EmailConfirmedPage />} />
        </Routes>
      </main>
    </div>
  );
}

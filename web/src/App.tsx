import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import MoviesPage from './pages/MoviesPage';
import VocabularyPage from './pages/VocabularyPage';
import GrammarPage from './pages/GrammarPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import MainLayout from './layouts/MainLayout';
import MagicLoginPage from './pages/MagicLoginPage';
import AuthModal from './components/AuthModal';
import PlayerPage from './pages/PlayerPage';

function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/landing" element={<HomePage />} />
        <Route path="/auth/login" element={<MagicLoginPage />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="movies" element={<MoviesPage />} />
          <Route path="player/:mediaId" element={<PlayerPage />} />
          <Route path="vocabulary" element={<VocabularyPage />} />
          <Route path="grammar" element={<GrammarPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <AuthModal />
    </div>
  );
}

export default App;

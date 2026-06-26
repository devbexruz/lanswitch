import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import MoviesPage from './pages/MoviesPage';
import VocabularyPage from './pages/VocabularyPage';
import GrammarPage from './pages/GrammarPage';
import ProfilePage from './pages/ProfilePage';
import MainLayout from './layouts/MainLayout';
import MagicLoginPage from './pages/MagicLoginPage';
import AuthModal from './components/AuthModal';

function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/landing" element={<HomePage />} />
        <Route path="/auth/login" element={<MagicLoginPage />} />
        
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="movies" element={<MoviesPage />} />
          <Route path="vocabulary" element={<VocabularyPage />} />
          <Route path="grammar" element={<GrammarPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
      <AuthModal />
    </div>
  );
}

export default App;

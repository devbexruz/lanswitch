import { Routes, Route, Navigate } from 'react-router-dom';
import LanswitchPortalPage from './pages/LanswitchPortalPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import StudentMiniAppPage from './pages/StudentMiniAppPage';
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

function RootRoute() {
  const savedRoute = localStorage.getItem('lanswitch_last_route');
  if (savedRoute && (savedRoute.startsWith('/teacher') || savedRoute.startsWith('/tma') || savedRoute.startsWith('/student'))) {
    return <Navigate to={savedRoute} replace />;
  }

  try {
    const savedUser = localStorage.getItem('lanswitch_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      if (u.role === 'Teacher') {
        return <Navigate to="/teacher" replace />;
      }
    }
  } catch {}

  return <Navigate to="/student" replace />;
}

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* Lanswitch New Platform Routes */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/portal" element={<LanswitchPortalPage />} />
        <Route path="/teacher" element={<TeacherDashboardPage />} />
        <Route path="/tma" element={<StudentMiniAppPage />} />
        <Route path="/student" element={<StudentMiniAppPage />} />

        {/* Legacy Routes */}
        <Route path="/landing" element={<HomePage />} />
        <Route path="/auth/login" element={<MagicLoginPage />} />
        <Route path="/legacy" element={<MainLayout />}>
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

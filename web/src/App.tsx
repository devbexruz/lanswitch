import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
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
import VerifyReceiptPage from './pages/VerifyReceiptPage';

function SmartRoleRoute() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';

  // 1. Agar URL da role yoki branch parametri aniq berilgan bo'lsa (eng yuqori prioritet)
  const roleParam = searchParams.get('role')?.toLowerCase() || searchParams.get('branch')?.toLowerCase();
  if (roleParam === 'teacher') {
    return <Navigate to={`/teacher${search}`} replace />;
  }
  if (roleParam === 'student') {
    return <Navigate to={`/student${search}`} replace />;
  }

  // 2. Foydalanuvchining aktiv roli (state yoki localStorage)
  let role = user?.role;
  if (!role) {
    try {
      const savedUser = localStorage.getItem('lanswitch_user');
      if (savedUser) {
        role = JSON.parse(savedUser)?.role;
      }
    } catch {}
  }

  if (role === 'Teacher') {
    return <Navigate to={`/teacher${search}`} replace />;
  }
  if (role === 'Student') {
    return <Navigate to={`/student${search}`} replace />;
  }

  // 3. Oxirgi kirilgan marshrut
  const savedRoute = localStorage.getItem('lanswitch_last_route');
  if (savedRoute && savedRoute.startsWith('/teacher')) {
    return <Navigate to={`/teacher${search}`} replace />;
  }

  return <Navigate to={`/student${search}`} replace />;
}

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* Lanswitch New Platform Routes */}
        <Route path="/" element={<SmartRoleRoute />} />
        <Route path="/tma" element={<SmartRoleRoute />} />
        <Route path="/portal" element={<LanswitchPortalPage />} />
        <Route path="/teacher" element={<TeacherDashboardPage />} />
        <Route path="/student" element={<StudentMiniAppPage />} />

        {/* Movie Player Routes (Standalone, no legacy Sidebar/Header) */}
        <Route path="/player/:mediaId" element={<PlayerPage />} />
        <Route path="/legacy/player/:mediaId" element={<PlayerPage />} />

        {/* Standalone Admin Panel & Verification */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/verify-receipt/:id" element={<VerifyReceiptPage />} />

        {/* Legacy Routes */}
        <Route path="/landing" element={<HomePage />} />
        <Route path="/auth/login" element={<MagicLoginPage />} />
        <Route path="/legacy" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="movies" element={<MoviesPage />} />
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

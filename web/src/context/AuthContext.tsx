import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: number;
  telegramId: string;
  fullName: string;
  profileImage?: string;
  nativeLanguageId: number;
  role?: 'Student' | 'Teacher' | 'Admin' | string;
  isAdmin: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  setRole: (role: 'Student' | 'Teacher') => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  requireAuth: (callback: () => void) => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('lanswitch_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  const checkAuth = async () => {
    try {
      // 1. Agar Telegram WebApp yoki URL parametrlari bo'lsa, avtomatik kirish
      const urlParams = new URLSearchParams(window.location.search);
      const tg = (window as any).Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;
      const queryTgId = urlParams.get('telegram_id') || tgUser?.id?.toString();
      const queryUserId = urlParams.get('user_id');

      if (tgUser || queryTgId || queryUserId) {
        try {
          const autoRes = await fetch('/api/auth/telegram-auto-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: queryTgId || tgUser?.id?.toString(),
              userId: queryUserId ? parseInt(queryUserId, 10) : undefined,
              firstName: tgUser?.first_name,
              lastName: tgUser?.last_name,
              username: tgUser?.username,
              photoUrl: tgUser?.photo_url,
              initData: tg?.initData
            })
          });
          if (autoRes.ok) {
            const data = await autoRes.json();
            if (data.user) {
              setUser(data.user);
              localStorage.setItem('lanswitch_user', JSON.stringify(data.user));
            }
            if (data.accessToken) {
              localStorage.setItem('lanswitch_token', data.accessToken);
              localStorage.setItem('token', data.accessToken);
            }
            return;
          }
        } catch (e) {
          console.warn('Auto login error:', e);
        }
      }

      // 2. Standart /api/users/me tekshirish
      const response = await fetch('/api/users/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('lanswitch_user', JSON.stringify(userData));
      } else if (response.status === 401) {
        setUser(null);
        localStorage.removeItem('lanswitch_user');
        localStorage.removeItem('lanswitch_token');
      }
    } catch (e) {
      console.error('Failed to fetch user', e);
    }
  };

  useEffect(() => {
    checkAuth();
    
    const handleAuthFailed = () => {
      setUser(null);
      localStorage.removeItem('lanswitch_user');
      localStorage.removeItem('lanswitch_token');
    };
    
    window.addEventListener('auth-failed', handleAuthFailed);
    return () => window.removeEventListener('auth-failed', handleAuthFailed);
  }, []);

  const login = async () => {
    await checkAuth();
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    localStorage.removeItem('lanswitch_user');
    localStorage.removeItem('lanswitch_token');
  };

  const setRole = async (newRole: 'Student' | 'Teacher') => {
    try {
      await fetch('/api/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, userId: user?.id })
      });
      if (user) {
        const updated = { ...user, role: newRole };
        setUser(updated);
        localStorage.setItem('lanswitch_user', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to update role', e);
    }
  };

  const requireAuth = (callback: () => void) => {
    if (user) {
      callback();
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <AuthContext.Provider value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        setRole,
        showAuthModal,
        setShowAuthModal,
        requireAuth,
        checkAuth
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

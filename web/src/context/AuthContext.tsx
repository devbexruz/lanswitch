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
  balance?: number;
  hasReceivedInitialBonus?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  hasSubscription: boolean;
  hasPriorSubscription: boolean;
  subscription: any | null;
  canClaimBonus: boolean;
  bonusAmount: number;
  minAmount: number;
  claimBonus: () => Promise<boolean>;
  checkSubscription: () => Promise<void>;
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
  const [subscription, setSubscription] = useState<any | null>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lanswitch_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u?.isAdmin) return true;
      }
    } catch {}
    return false;
  });
  const [hasPriorSubscription, setHasPriorSubscription] = useState<boolean>(false);

  const [canClaimBonus, setCanClaimBonus] = useState<boolean>(false);
  const [bonusAmount, setBonusAmount] = useState<number>(25000);
  const [minAmount, setMinAmount] = useState<number>(15000);

  const checkSubscription = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const res = await fetch('/api/subscription/my', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription || null);
        const isSubActive = Boolean(user?.isAdmin || (data.hasActiveSubscription && data.subscription?.isActive));
        setHasSubscription(isSubActive);
        setHasPriorSubscription(Boolean(data.hasPriorSubscription));
        setCanClaimBonus(Boolean(data.canClaimBonus));
        if (data.bonusAmount) setBonusAmount(Number(data.bonusAmount));
        if (data.minAmount) setMinAmount(Number(data.minAmount));
        if (data.user?.balance !== undefined && user) {
          if (user.balance !== data.user.balance || user.hasReceivedInitialBonus !== data.user.hasReceivedInitialBonus) {
            const updated = { 
              ...user, 
              balance: data.user.balance, 
              hasReceivedInitialBonus: data.user.hasReceivedInitialBonus 
            };
            setUser(updated);
            localStorage.setItem('lanswitch_user', JSON.stringify(updated));
          }
        }
      } else {
        setHasSubscription(Boolean(user?.isAdmin));
        setSubscription(null);
        setCanClaimBonus(false);
      }
    } catch {
      setHasSubscription(Boolean(user?.isAdmin));
      setSubscription(null);
      setCanClaimBonus(false);
    }
  };

  const claimBonus = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const res = await fetch('/api/subscription/claim-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCanClaimBonus(false);
        if (user) {
          const updated = { 
            ...user, 
            balance: data.balance, 
            hasReceivedInitialBonus: true 
          };
          setUser(updated);
          localStorage.setItem('lanswitch_user', JSON.stringify(updated));
        }
        await checkSubscription();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Claim bonus error:', e);
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      if (user.isAdmin) {
        setHasSubscription(true);
      }
      checkSubscription();
    } else {
      setHasSubscription(false);
      setSubscription(null);
    }
  }, [user?.id, user?.isAdmin]);

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
    setSubscription(null);
    setHasSubscription(false);
    localStorage.removeItem('lanswitch_user');
    localStorage.removeItem('lanswitch_token');
  };

  const setRole = async (newRole: 'Student' | 'Teacher') => {
    try {
      let uid = user?.id;
      if (!uid) {
        try {
          const saved = localStorage.getItem('lanswitch_user');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.id) uid = parsed.id;
          }
        } catch {}
      }
      const res = await fetch('/api/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, userId: uid })
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.user || (user ? { ...user, role: newRole } : { id: uid, role: newRole });
        setUser(updated);
        localStorage.setItem('lanswitch_user', JSON.stringify(updated));
      } else if (user) {
        const updated = { ...user, role: newRole };
        setUser(updated);
        localStorage.setItem('lanswitch_user', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to update role', e);
      if (user) {
        const updated = { ...user, role: newRole };
        setUser(updated);
        localStorage.setItem('lanswitch_user', JSON.stringify(updated));
      }
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
        hasSubscription,
        hasPriorSubscription,
        subscription,
        canClaimBonus,
        bonusAmount,
        minAmount,
        claimBonus,
        checkSubscription,
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

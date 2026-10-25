import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Check, LogOut, Film, BookOpen, 
  ChevronDown, ArrowRightLeft, Crown, ShieldCheck
} from 'lucide-react';
import SubscriptionPlansModal from './SubscriptionPlansModal';

interface ProfileDropdownProps {
  onNavigateTab?: (tab: string) => void;
  variant?: 'teacher' | 'student';
}

export default function ProfileDropdown({ onNavigateTab }: ProfileDropdownProps) {
  const { user, isAuthenticated, logout, setRole, login } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isTeacherRoute = location.pathname.startsWith('/teacher');
  const currentRole = user?.role === 'Teacher' || (!user?.role && isTeacherRoute) ? 'Teacher' : 'Student';

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchRole = async (targetRole: 'Student' | 'Teacher') => {
    setIsSwitching(true);
    try {
      if (user?.role !== targetRole) {
        await setRole(targetRole);
      }
      setIsOpen(false);
      const search = window.location.search || '';
      if (targetRole === 'Teacher') {
        localStorage.setItem('lanswitch_last_route', '/teacher');
        navigate(`/teacher${search}`);
      } else {
        localStorage.setItem('lanswitch_last_route', '/student');
        navigate(`/student${search}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSwitching(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px 6px 8px',
          background: 'var(--pure-white)',
          border: '1.5px solid var(--sky-border)',
          borderRadius: 'var(--radius-pill)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: 'var(--shadow-subtle)'
        }}
      >
        {user?.profileImage ? (
          <img
            src={user.profileImage}
            alt={user.fullName}
            style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'var(--primary-blue)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 800
          }}>
            {getInitials(user?.fullName)}
          </div>
        )}

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '95px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.fullName || 'Foydalanuvchi'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--primary-blue)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {currentRole === 'Teacher' ? "👨‍🏫 O'qituvchi" : '🎓 Talaba'}
          </span>
        </div>

        <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      {/* Dropdown Menu (Underneath profile button) */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '290px',
          background: 'var(--pure-white)',
          border: '2px solid var(--sky-border)',
          borderRadius: '18px',
          boxShadow: 'var(--shadow-modal)',
          zIndex: 1000,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          animation: 'fadeIn 0.15s ease'
        }}>
          {/* User Bio Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--sky-border)'
          }}>
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.fullName}
                style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'var(--primary-blue)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 900
              }}>
                {getInitials(user?.fullName)}
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.fullName || 'Profil'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                ID: {user?.id || '—'} {user?.telegramId ? `• @${user.telegramId}` : ''}
              </div>
            </div>
          </div>

          {/* Role Switcher Section (Database Persisted) */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--primary-blue)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px'
            }}>
              <ArrowRightLeft size={13} />
              <span>Aktiv Rolni Tanlash (Database)</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              background: 'var(--ice-blue-bg)',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid var(--sky-border)'
            }}>
              {/* Teacher option */}
              <button
                disabled={isSwitching}
                onClick={() => handleSwitchRole('Teacher')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 8px',
                  borderRadius: '10px',
                  border: 'none',
                  background: currentRole === 'Teacher' ? 'var(--primary-blue)' : 'transparent',
                  color: currentRole === 'Teacher' ? '#fff' : 'var(--text-navy)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: isSwitching ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>👨‍🏫 O'qituvchi</span>
                {currentRole === 'Teacher' && <Check size={14} />}
              </button>

              {/* Student option */}
              <button
                disabled={isSwitching}
                onClick={() => handleSwitchRole('Student')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 8px',
                  borderRadius: '10px',
                  border: 'none',
                  background: currentRole === 'Student' ? 'var(--primary-blue)' : 'transparent',
                  color: currentRole === 'Student' ? '#fff' : 'var(--text-navy)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: isSwitching ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🎓 Talaba</span>
                {currentRole === 'Student' && <Check size={14} />}
              </button>
            </div>
          </div>

          {/* Tariflar / Obunalar (14 kun bepul) */}
          <button
            onClick={() => {
              setIsOpen(false);
              setIsPlansOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '11px 12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(245, 158, 11, 0.25))',
              border: '1.5px solid rgba(234, 179, 8, 0.4)',
              color: '#92400e',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(234, 179, 8, 0.15)'
            }}
          >
            <Crown size={18} color="#b45309" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#78350f', fontWeight: 900 }}>Tariflar va Balans</span>
              <span style={{ fontSize: '10.5px', color: '#047857', fontWeight: 700 }}>🎁 25 000 so'm bonus</span>
            </div>
          </button>

          {/* Admin Panel (Faqat Adminlar uchun) */}
          {user?.isAdmin && (
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/admin');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12), rgba(99, 102, 241, 0.2))',
                border: '1.5px solid rgba(79, 70, 229, 0.35)',
                color: '#3730a3',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <ShieldCheck size={18} color="#4f46e5" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#312e81', fontWeight: 900 }}>🛡️ Admin Panel</span>
                <span style={{ fontSize: '10.5px', color: '#4f46e5', fontWeight: 700 }}>Tariflar, Cheklar va Boshqaruv</span>
              </div>
            </button>
          )}

          {/* Navigation Quick Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => {
                setIsOpen(false);
                if (onNavigateTab) {
                  onNavigateTab('movies');
                } else {
                  navigate(currentRole === 'Teacher' ? '/teacher' : '/tma');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-navy)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ice-blue-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Film size={16} color="var(--primary-blue)" />
              <span>🎬 Kinolar va Seriallar</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                if (onNavigateTab) {
                  onNavigateTab('vocabulary');
                } else {
                  navigate(currentRole === 'Teacher' ? '/teacher' : '/tma');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-navy)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ice-blue-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <BookOpen size={16} color="var(--primary-blue)" />
              <span>📖 So'z yodlash (Lug'at)</span>
            </button>
          </div>

          {/* Logout Action */}
          <div style={{ paddingTop: '8px', borderTop: '1px solid var(--sky-border)' }}>
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  color: 'var(--status-danger)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  justifyContent: 'center'
                }}
              >
                <LogOut size={15} />
                <span>Tizimdan chiqish</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  login();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--primary-blue)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  justifyContent: 'center'
                }}
              >
                <span>Kirish (Telegram)</span>
              </button>
            )}
          </div>
        </div>
      )}

      <SubscriptionPlansModal
        isOpen={isPlansOpen}
        onClose={() => setIsPlansOpen(false)}
      />
    </div>
  );
}

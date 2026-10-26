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

export default function ProfileDropdown({ onNavigateTab, variant }: ProfileDropdownProps) {
  const { user, isAuthenticated, logout, setRole, login, hasSubscription, subscription, checkSubscription, canClaimBonus, bonusAmount } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isTeacherRoute = variant ? variant === 'teacher' : location.pathname.startsWith('/teacher');
  const currentRole = isTeacherRoute ? 'Teacher' : 'Student';
  const isRoleSubActive = user?.isAdmin || (hasSubscription && (isTeacherRoute ? subscription?.targetRole === 'Teacher' : true));

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
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
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

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '105px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.fullName || 'Foydalanuvchi'}
          </span>
          <span style={{
            fontSize: '10.5px',
            color: isRoleSubActive ? '#059669' : '#DC2626',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            {isRoleSubActive ? (
              <span>{subscription?.planName ? subscription.planName.replace('Ustoz - ', '') : (user?.isAdmin ? 'Admin' : 'Premium')}</span>
            ) : (
              <span>🔴 Tugagan</span>
            )}
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
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
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
              {isRoleSubActive ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10B981',
                  color: '#065F46',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  marginTop: '4px'
                }}>
                  <span>✓</span>
                  <span>{subscription?.planName || (user?.isAdmin ? 'Administrator' : 'Premium')}</span>
                </div>
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#FEE2E2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  marginTop: '4px'
                }}>
                  <span>🔴</span>
                  <span>{subscription?.targetRole === 'Student' && isTeacherRoute ? "Ustoz tarifi faol emas" : "Tarif muddati tugagan"}</span>
                </div>
              )}
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

          {/* Tariflar / Obunalar */}
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
              background: hasSubscription 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.15))' 
                : canClaimBonus
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.2))'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.14))',
              border: hasSubscription 
                ? '1.5px solid #10B981' 
                : canClaimBonus
                  ? '1.5px solid #10B981'
                  : '1.5px solid #FCA5A5',
              color: hasSubscription ? '#065F46' : canClaimBonus ? '#065F46' : '#991B1B',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <Crown size={18} color={hasSubscription ? '#10B981' : canClaimBonus ? '#10B981' : '#DC2626'} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: hasSubscription ? '#065F46' : canClaimBonus ? '#065F46' : '#991B1B', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Tariflar va Balans</span>
                {!hasSubscription && !canClaimBonus && (
                  <span style={{ background: '#DC2626', color: '#fff', fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                    Tugagan
                  </span>
                )}
                {canClaimBonus && (
                  <span style={{ background: '#10B981', color: '#fff', fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                    🎁 {bonusAmount.toLocaleString('uz-UZ')} bonus
                  </span>
                )}
              </span>
              <span style={{ fontSize: '11px', color: hasSubscription ? '#047857' : canClaimBonus ? '#059669' : '#DC2626', fontWeight: 800 }}>
                {hasSubscription ? (
                  subscription?.formattedRemainingTime ? `⏳ ${subscription.formattedRemainingTime}` : '✨ Obuna faol'
                ) : (
                  canClaimBonus ? `🎁 ${bonusAmount.toLocaleString('uz-UZ')} bonusni oling!` : "🔴 Tarif muddati tugagan"
                )}
              </span>
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
        onSubscriptionUpdated={() => {
          checkSubscription();
        }}
      />
    </div>
  );
}

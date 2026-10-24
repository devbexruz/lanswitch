import type { ElementType } from 'react';
import { BookOpen, Film, Library, Users } from 'lucide-react';

interface NavTabItem {
  id: string;
  label: string;
  icon: ElementType;
  badge?: number;
}

interface BottomNavProps {
  role: 'student' | 'teacher';
  activeTab: string;
  onChangeTab: (tab: string) => void;
  badgeCount?: number;
}

export default function BottomNav({ role, activeTab, onChangeTab, badgeCount = 0 }: BottomNavProps) {
  const studentTabs: NavTabItem[] = [
    { id: 'homework', label: 'Topshiriqlar', icon: BookOpen },
    { id: 'movies', label: 'Kinolar', icon: Film },
    { id: 'vocabulary', label: 'Lug\'at', icon: Library }
  ];

  const teacherTabs: NavTabItem[] = [
    { id: 'assignments', label: 'Topshiriqlar', icon: BookOpen, badge: badgeCount },
    { id: 'students', label: 'O\'quvchilar', icon: Users },
    { id: 'movies', label: 'Kinolar', icon: Film },
    { id: 'vocabulary', label: 'Lug\'at', icon: Library }
  ];

  const tabs = role === 'student' ? studentTabs : teacherTabs;

  return (
    <>
      {/* ======================================================== */}
      {/* 1. DESKTOP LEFT SIDEBAR (>= 769px)                       */}
      {/* ======================================================== */}
      <aside
        className="app-desktop-sidebar"
        style={{
          width: '260px',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          background: 'var(--pure-white)',
          borderRight: '2px solid var(--sky-border)',
          zIndex: 60,
          display: 'none', // Controlled by CSS .app-desktop-sidebar
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px 16px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div>
          {/* Logo & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px', marginBottom: '28px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '14px',
                background: 'var(--primary-blue)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '22px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              L
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-navy)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                LANSWITCH
              </div>
              <span
                style={{
                  fontSize: '11px',
                  background: 'var(--ice-blue-bg)',
                  color: 'var(--primary-blue)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 800,
                  display: 'inline-block',
                  marginTop: '4px'
                }}
              >
                {role === 'teacher' ? 'TEACHER PANEL' : 'STUDENT APP'}
              </span>
            </div>
          </div>

          {/* Nav List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const showBadge = tab.badge !== undefined && tab.badge > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => onChangeTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    border: isActive ? '1.5px solid var(--sky-border)' : '1.5px solid transparent',
                    background: isActive ? 'var(--ice-blue-bg)' : 'transparent',
                    color: isActive ? 'var(--primary-blue)' : 'var(--text-navy)',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '15px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon
                      size={22}
                      color={isActive ? 'var(--primary-blue)' : 'var(--text-muted)'}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span>{tab.label}</span>
                  </div>
                  {showBadge && (
                    <span
                      style={{
                        background: '#EF4444',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 900,
                        borderRadius: '9999px',
                        padding: '2px 8px',
                        minWidth: '20px',
                        textAlign: 'center'
                      }}
                    >
                      {tab.badge! > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer in Desktop Sidebar */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--sky-border)', borderRadius: '12px', background: 'var(--ice-blue-card)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
            Lanswitch Platform
          </div>
          <div style={{ fontSize: '11px', color: 'var(--primary-blue)', fontWeight: 800, marginTop: '2px' }}>
            {role === 'teacher' ? '👨‍🏫 O\'qituvchi Boshqaruvi' : '🎓 Talaba Ilovasi'}
          </div>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MOBILE BOTTOM NAVIGATION BAR (<= 768px)               */}
      {/* ======================================================== */}
      <nav
        className="app-mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '640px',
          background: 'var(--pure-white)',
          borderTop: '2px solid var(--sky-border)',
          borderLeft: '1.5px solid var(--sky-border)',
          borderRight: '1.5px solid var(--sky-border)',
          borderRadius: '20px 20px 0 0',
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          paddingTop: '6px',
          paddingLeft: 'calc(8px + var(--safe-area-left, env(safe-area-inset-left, 0px)))',
          paddingRight: 'calc(8px + var(--safe-area-right, env(safe-area-inset-right, 0px)))',
          paddingBottom: 'calc(8px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
          zIndex: 70,
          boxShadow: '0 -4px 20px rgba(15, 23, 42, 0.08)',
          backdropFilter: 'blur(10px)',
          userSelect: 'none'
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.badge !== undefined && tab.badge > 0;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              style={{
                background: isActive ? 'var(--ice-blue-bg)' : 'transparent',
                border: 'none',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px 4px',
                cursor: 'pointer',
                color: isActive ? 'var(--primary-blue)' : 'var(--text-muted)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '11px',
                position: 'relative',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon
                  size={21}
                  color={isActive ? 'var(--primary-blue)' : 'var(--text-muted)'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {showBadge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-10px',
                      background: '#EF4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 900,
                      borderRadius: '9999px',
                      padding: '1px 5px',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    {tab.badge! > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                style={{
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%'
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

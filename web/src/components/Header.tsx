import React, { useState } from 'react';
import './Header.css';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationsModal from './NotificationsModal';

interface HeaderProps {
  isSidebarExpanded: boolean;
}

const Header: React.FC<HeaderProps> = ({ isSidebarExpanded }) => {
  const { learningLanguage, setLearningLanguage, activeLearningLanguages } = useLanguage();
  const { user, isAuthenticated, requireAuth } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notification');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <header className="dashboard-header">
      <div className="header-left">
        {!isSidebarExpanded && (
           <div className="nav-brand header-brand">
             Lan<span className="accent">switch</span>
           </div>
        )}
        {isSidebarExpanded && (
           <div className="nav-brand header-brand" style={{marginLeft: '10px'}}>
             Lan<span className="accent">switch</span>
           </div>
        )}
      </div>
      
      <div className="search-container">
        <div className="search-bar glass-panel">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" placeholder="Qidirish..." />
        </div>
      </div>

      <div className="header-actions">
        {/* Language Switcher */}
        <div className="language-switcher glass-panel" style={{display: 'flex', padding: '4px', borderRadius: '20px', marginRight: '10px', alignItems: 'center'}}>
          {activeLearningLanguages.includes('en') && (
            <button 
              className={`lang-btn ${learningLanguage === 'en' ? 'active' : ''}`}
              onClick={() => setLearningLanguage('en')}
              style={{display: 'flex', alignItems: 'center', padding: '4px 12px', border: 'none', background: learningLanguage === 'en' ? 'var(--accent-secondary)' : 'transparent', color: learningLanguage === 'en' ? '#000' : 'white', borderRadius: '16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s'}}
            >
              <img src="https://flagcdn.com/w20/gb.png" alt="UK" style={{width: '16px', marginRight: '6px', borderRadius: '2px'}} /> Ingliz
            </button>
          )}
          {activeLearningLanguages.includes('ru') && (
            <button 
              className={`lang-btn ${learningLanguage === 'ru' ? 'active' : ''}`}
              onClick={() => setLearningLanguage('ru')}
              style={{display: 'flex', alignItems: 'center', padding: '4px 12px', border: 'none', background: learningLanguage === 'ru' ? 'var(--accent-secondary)' : 'transparent', color: learningLanguage === 'ru' ? '#000' : 'white', borderRadius: '16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s'}}
            >
              <img src="https://flagcdn.com/w20/ru.png" alt="RU" style={{width: '16px', marginRight: '6px', borderRadius: '2px'}} /> Rus
            </button>
          )}
        </div>

        {isAuthenticated ? (
          <>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" title="Bildirishnomalar" onClick={() => setIsNotifOpen(!isNotifOpen)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {hasUnread && <span className="notification-dot"></span>}
              </button>
              <NotificationsModal 
                isOpen={isNotifOpen} 
                onClose={() => setIsNotifOpen(false)} 
                notifications={notifications}
                onMarkAsRead={async (id) => {
                  await fetch(`/api/notification/${id}/read`, { method: 'POST' });
                  fetchNotifications();
                }}
                onMarkAllAsRead={async () => {
                  await fetch(`/api/notification/read-all`, { method: 'POST' });
                  fetchNotifications();
                }}
              />
            </div>

            <button className="profile-btn" title="Profil" onClick={() => navigate('/profile')}>
              <div className="profile-img-wrapper">
                <img src={user?.profileImage || `https://ui-avatars.com/api/?name=${user?.fullName || 'User'}&background=0d3b66&color=faf0ca`} alt="Profil" />
              </div>
            </button>
          </>
        ) : (
          <button 
            className="btn btn-primary" 
            onClick={() => requireAuth(() => {})}
            style={{ padding: '8px 20px', borderRadius: '20px', fontSize: '0.9rem' }}
          >
            Tizimga kirish
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;

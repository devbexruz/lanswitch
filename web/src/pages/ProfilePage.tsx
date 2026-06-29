import React from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
  const { user, logout, checkAuth } = useAuth();
  
  const handleEditName = async () => {
    const newName = prompt("Yangi ism-familiyani kiriting:", user?.fullName);
    if (newName && newName.trim() !== user?.fullName) {
      try {
        const res = await fetch('/api/users/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: newName.trim() })
        });
        if (res.ok) {
          await checkAuth(); // refresh user context
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="profile-page animate-fade-in">
      <div className="profile-header glass-panel">
        <div className="profile-info-main">
          <div className="profile-avatar">
            <img src={user?.profileImage || `https://ui-avatars.com/api/?name=${user?.fullName || 'User'}&background=0d3b66&color=faf0ca&size=150`} alt="Avatar" />
            <div className="pro-badge">PRO ✨</div>
          </div>
          <div className="profile-details">
            <h1 className="profile-name">{user?.fullName || 'Foydalanuvchi'}</h1>
            <p className="profile-email">Telegram ID: {user?.telegramId}</p>
            <p className="profile-bio">O'rganishda doim oldinda!</p>
            <div className="profile-actions">
              <button className="btn btn-primary" onClick={handleEditName}>Tahrirlash</button>
              <button className="btn btn-outline-light" onClick={logout}>Chiqish</button>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-content-grid">
        {/* Statistics */}
        <div className="profile-section glass-panel">
          <h2>Statistika</h2>
          <div className="stats-grid-mini">
            <div className="stat-item">
              <span className="stat-number">142</span>
              <span className="stat-label">O'rganilgan So'zlar</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">30</span>
              <span className="stat-label">Faol Formulalar</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">12</span>
              <span className="stat-label">Ko'rilgan Kinolar</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">15</span>
              <span className="stat-label">Kunlik Streak 🔥</span>
            </div>
          </div>
        </div>

        {/* Achievements */}
        <div className="profile-section glass-panel">
          <h2>Yutuqlar</h2>
          <div className="achievements-list">
            <div className="achievement-card">
              <div className="achievement-icon" style={{ background: 'rgba(244, 211, 94, 0.2)', color: 'var(--color-royal-gold)' }}>
                🏆
              </div>
              <div className="achievement-info">
                <h4>Hafta Qahramoni</h4>
                <p>7 kun ketma-ket darslarni bajardingiz</p>
              </div>
            </div>
            <div className="achievement-card">
              <div className="achievement-icon" style={{ background: 'rgba(102, 155, 188, 0.2)', color: 'var(--color-steel-blue)' }}>
                📚
              </div>
              <div className="achievement-info">
                <h4>Lug'at Ustasi</h4>
                <p>100 ta so'zni yod oldingiz</p>
              </div>
            </div>
            <div className="achievement-card locked">
              <div className="achievement-icon" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#888' }}>
                🎬
              </div>
              <div className="achievement-info">
                <h4>Kino Shinavandasi</h4>
                <p>20 ta kino ko'ring (12/20)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

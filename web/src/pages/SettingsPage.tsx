import React, { useEffect, useState } from 'react';
import './SettingsPage.css';
import { useAuth } from '../context/AuthContext';

const SettingsPage: React.FC = () => {
  const { user, checkAuth } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user?.fullName]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSaveName = async () => {
    if (fullName.trim() === user?.fullName || fullName.trim() === '') return;
    setIsSavingName(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() })
      });
      if (res.ok) {
        await checkAuth();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingName(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!window.confirm("Rostdan ham ushbu seansdan chiqib ketmoqchimisiz?")) return;

    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
      } else {
        alert("Xatolik yuz berdi");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="settings-page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Sozlamalar</h1>
        <p className="page-subtitle">Hisob va xavfsizlikni boshqarish</p>
      </div>

      <div className="settings-container">
        {/* Profil ma'lumotlari */}
        <section className="settings-section glass-panel">
          <h2>Shaxsiy Ma'lumotlar</h2>
          <div className="settings-form">
            <div className="form-group">
              <label>F.I.SH</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  className="form-control" 
                  style={{ flex: 1 }}
                />
                {fullName !== user?.fullName && (
                  <button className="btn btn-primary" onClick={handleSaveName} disabled={isSavingName}>
                    {isSavingName ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Telegram ID</label>
              <input type="text" value={user?.telegramId || ''} readOnly className="form-control" />
            </div>
          </div>
        </section>

        {/* Faol Seanslar */}
        <section className="settings-section glass-panel">
          <h2>Faol Seanslar (Qurilmalar)</h2>
          <p className="section-desc">Hozirda sizning hisobingizga ulangan barcha faol qurilmalar. Shubhali seanslarni o'chirib yuboring.</p>
          
          {loading ? (
            <div className="flex-center" style={{ padding: '20px' }}>Yuklanmoqda...</div>
          ) : (
            <div className="sessions-list">
              {sessions.map(session => {
                const date = new Date(session.createdAt).toLocaleString('uz-UZ');
                return (
                  <div key={session.id} className="session-item">
                    <div className="session-icon">
                      {session.device === 'web' ? '💻' : '📱'}
                    </div>
                    <div className="session-details">
                      <div className="session-device">{session.agent?.split(' ')[0] || 'Noma\'lum brauzer'}</div>
                      <div className="session-ip">IP: {session.ipAddress}</div>
                      <div className="session-time">Kirgan vaqti: {date}</div>
                    </div>
                    <button 
                      className="btn btn-outline-danger"
                      onClick={() => handleRevoke(session.id)}
                    >
                      Chiqish
                    </button>
                  </div>
                );
              })}
              {sessions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.5)' }}>
                  Boshqa faol seanslar yo'q
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;

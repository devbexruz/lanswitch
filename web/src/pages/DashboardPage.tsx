import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const mockData: Record<'en' | 'ru', any> = {
  en: {
    movies: [],
    reviews: [
      { id: 1, type: "So'zlar", count: 15, message: "15 ta so'z faol emas. Qayta takrorlang!", color: "var(--color-papaya-whip)" },
      { id: 2, type: "Grammatika", count: 2, message: "2 ta grammatik formula yoddan chiqmoqda.", color: "var(--color-flag-red)" }
    ]
  },
  ru: {
    movies: [],
    reviews: [
      { id: 101, type: "Слова", count: 8, message: "8 слов неактивны. Повторите!", color: "var(--color-papaya-whip)" },
      { id: 102, type: "Грамматика", count: 1, message: "1 правило забывается.", color: "var(--color-flag-red)" }
    ]
  }
};

const DashboardPage: React.FC = () => {
  const { learningLanguage } = useLanguage();
  const { user, isAuthenticated, requireAuth } = useAuth();
  const navigate = useNavigate();
  const [continueWatching, setContinueWatching] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (isAuthenticated && user) {
      fetch(`/api/watchhistory/continue-watching/${user.id}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setContinueWatching(data))
        .catch(err => console.error("Error fetching watch history", err));
    }
  }, [isAuthenticated, user]);

  const currentData = mockData[learningLanguage];

  const handleMovieClick = (historyItem: any) => {
    requireAuth(() => {
      let url = `/player/${historyItem.mediaId}`;
      if (historyItem.episodeId) {
        url += `?episodeId=${historyItem.episodeId}`;
      }
      navigate(url);
    });
  };

  const handleStartLearning = () => {
    requireAuth(() => {
      console.log("Starting learning session...");
    });
  };

  const handleRemoveHistory = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/watchhistory/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setContinueWatching(prev => prev.filter((item: any) => item.id !== id));
      }
    } catch (err) {
      console.error("Error removing from history", err);
    }
  };

  return (
    <div className="dashboard-content animate-fade-in">
      <div className="dashboard-grid">
        
        {/* Chap qism: Asosiy statistika va Davom etish */}
        <div className="main-column">
          <section className="welcome-section">
            <h1 className="greeting">Xush kelibsiz, <span>{isAuthenticated ? (user?.fullName || 'Foydalanuvchi') : 'Mehmon'}!</span> 👋</h1>
            <p className="subtitle">
              {isAuthenticated 
                ? "Bugun ham o'z ustingizda ishlashda davom etamiz." 
                : "LanSwitch bilan tillarni kinolar orqali o'rganing! Barcha imkoniyatlarni ko'rish uchun kiring."}
            </p>
          </section>

          <section className="continue-watching-section mt-4">
            <div className="section-header">
              <h2 className="section-title">Davom etish</h2>
            </div>
            {continueWatching.length > 0 ? (
              <div className="continue-grid">
                {continueWatching.map((item: any) => {
                  const media = item.media;
                  const episode = item.episode;
                  const duration = episode ? episode.durationalMinutes * 60 : media.durationalMinutes * 60;
                  const progress = Math.min(100, Math.max(0, (item.currentTimeSeconds / duration) * 100));
                  const title = episode ? `${media.title} - ${episode.episodeNumber}-qism` : media.title;

                  return (
                    <div key={item.id} className="continue-card glass-panel" onClick={() => handleMovieClick(item)} style={{cursor: 'pointer', position: 'relative'}}>
                      <button 
                        onClick={(e) => handleRemoveHistory(e, item.id)}
                        className="remove-history-btn"
                        title="Ro'yxatdan o'chirish"
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 20,
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ✕
                      </button>
                      <div className="continue-img-wrapper" style={{ position: 'relative' }}>
                        <img src={episode?.thumbnailUrl || media.thumbnailUrl || "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80"} alt={title} />
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          backgroundColor: media.isFilm ? 'var(--accent-primary)' : '#8b5cf6',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                          zIndex: 10
                        }}>
                          {media.isFilm ? 'KINO' : 'SERIAL'}
                        </div>
                        <div className="play-overlay-small">
                          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        </div>
                      </div>
                      <div className="continue-info">
                        <h3 style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{title}</h3>
                        <p className="time-remaining">{Math.round(item.currentTimeSeconds / 60)} / {Math.round(duration / 60)} daq</p>
                        <div className="progress-bar-container">
                          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="recommendation-placeholder glass-panel flex-center" style={{ padding: '20px', borderRadius: '12px' }}>
                 <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)' }}>Sizda hali davom etayotgan kinolar yo'q.</p>
              </div>
            )}
          </section>

          <section className="recommended-section mt-4">
             <div className="section-header">
                <h2 className="section-title">Siz uchun tavsiyalar</h2>
             </div>
             {/* Kichik ro'yxat */}
             <div className="recommendation-placeholder glass-panel flex-center">
                 <p>Sizning darajangizga mos kinolar tez orada bu yerda chiqadi.</p>
             </div>
          </section>
        </div>

        {/* O'ng qism: Progress va Urgent Reviews */}
        <div className="side-column">
          <section className="daily-goal-panel glass-panel">
            <h3 className="panel-title">Bugungi Maqsad</h3>
            <div className="progress-ring-container">
              <svg className="progress-ring" viewBox="0 0 120 120">
                <circle className="progress-ring-bg" cx="60" cy="60" r="50"></circle>
                <circle className="progress-ring-circle" cx="60" cy="60" r="50" style={{ strokeDashoffset: '125.6' }}></circle>
              </svg>
              <div className="progress-text">
                <span className="current">12</span>
                <span className="total">/ 20</span>
                <span className="label">so'z</span>
              </div>
            </div>
            <p className="goal-message">Yana 8 ta yangi so'z o'rganishingiz kerak!</p>
            <button className="btn btn-primary full-width" onClick={handleStartLearning}>O'rganishni boshlash</button>
          </section>

          <section className="urgent-reviews-panel mt-4">
            <h3 className="panel-title">Takrorlash zarur!</h3>
            <div className="urgent-list">
              {currentData.reviews.map((item: any) => (
                <div key={item.id} className="urgent-card" style={{ borderLeftColor: item.color }}>
                  <div className="urgent-icon" style={{ color: item.color }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </div>
                  <div className="urgent-info">
                    <h4>{item.type} ({item.count})</h4>
                    <p>{item.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;

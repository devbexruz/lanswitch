import React from 'react';
import './DashboardPage.css';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const mockData: Record<'en' | 'ru', any> = {
  en: {
    movies: [
      { id: 1, title: "Inception", progress: 65, timeRemaining: "45 min", image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80" },
      { id: 2, title: "Qashqirlar Makoni", progress: 30, timeRemaining: "1 soat 10 min", image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=400&q=80" },
    ],
    reviews: [
      { id: 1, type: "So'zlar", count: 15, message: "15 ta so'z faol emas. Qayta takrorlang!", color: "var(--color-papaya-whip)" },
      { id: 2, type: "Grammatika", count: 2, message: "2 ta grammatik formula yoddan chiqmoqda.", color: "var(--color-flag-red)" }
    ]
  },
  ru: {
    movies: [
      { id: 101, title: "Брат", progress: 45, timeRemaining: "50 мин", image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80" },
      { id: 102, title: "Кухня", progress: 80, timeRemaining: "5 мин", image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=400&q=80" },
    ],
    reviews: [
      { id: 101, type: "Слова", count: 8, message: "8 слов неактивны. Повторите!", color: "var(--color-papaya-whip)" },
      { id: 102, type: "Грамматика", count: 1, message: "1 правило забывается.", color: "var(--color-flag-red)" }
    ]
  }
};

const DashboardPage: React.FC = () => {
  const { learningLanguage } = useLanguage();
  const { user, isAuthenticated, requireAuth } = useAuth();
  const currentData = mockData[learningLanguage];

  const handleMovieClick = (movieId: number) => {
    requireAuth(() => {
      console.log(`Navigating to movie ${movieId}...`);
      // Kelajakda navigate(`/movies/${movieId}`) bo'ladi
    });
  };

  const handleStartLearning = () => {
    requireAuth(() => {
      console.log("Starting learning session...");
      // Kelajakda navigate(`/vocabulary/learn`)
    });
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
            <div className="continue-grid">
              {currentData.movies.map((movie: any) => (
                <div key={movie.id} className="continue-card glass-panel" onClick={() => handleMovieClick(movie.id)} style={{cursor: 'pointer'}}>
                  <div className="continue-img-wrapper">
                    <img src={movie.image} alt={movie.title} />
                    <div className="play-overlay-small">
                      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </div>
                  </div>
                  <div className="continue-info">
                    <h3>{movie.title}</h3>
                    <p className="time-remaining">{movie.timeRemaining} qoldi</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${movie.progress}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

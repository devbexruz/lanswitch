import React, { useState, useEffect } from 'react';
import './MoviesPage.css';
import { useLanguage } from '../context/LanguageContext';

const MoviesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const { learningLanguage } = useLanguage();

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const res = await fetch('/api/media');
        if (res.ok) {
          const data = await res.json();
          setMovies(data);
        }
      } catch (err) {
        console.error("Error fetching movies", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, []);

  // Filter movies by learningLanguage (English = 2, Russian = 3)
  const targetLanguageId = learningLanguage === 'en' ? 2 : (learningLanguage === 'ru' ? 3 : 1);
  let currentMovies = movies.filter(m => m.languageId === targetLanguageId || m.languageId === 1); 

  // Filter by selected levels
  if (selectedLevels.length > 0) {
    currentMovies = currentMovies.filter(m => selectedLevels.includes(m.level));
  }

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  if (loading) {
    return <div className="movies-page flex-center"><h3>Yuklanmoqda...</h3></div>;
  }

  const availableLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  return (
    <div className="movies-page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Kinolar Katalogi</h1>
        <p className="page-subtitle">O'zingizga mos kino va seriallarni toping</p>
      </div>

      <div className="movies-layout">
        {/* Filters Sidebar */}
        <aside className="filters-sidebar glass-panel">
          <h3>Filtrlar</h3>
          

          <div className="filter-group">
            <h4>Daraja</h4>
            <div className="level-tags">
              {availableLevels.map(lvl => (
                <button 
                  key={lvl}
                  className={`level-tag ${selectedLevels.includes(lvl) ? 'active' : ''}`}
                  onClick={() => toggleLevel(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <h4>Janrlar</h4>
            <label className="checkbox-label"><input type="checkbox" /> Komediya</label>
            <label className="checkbox-label"><input type="checkbox" /> Drama</label>
            <label className="checkbox-label"><input type="checkbox" /> Fantastika (Sci-Fi)</label>
            <label className="checkbox-label"><input type="checkbox" /> Triller</label>
          </div>
        </aside>

        {/* Movies Grid */}
        <div className="movies-content">
          <div className="movies-tabs">
            <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>Barchasi</button>
            <button className={`tab-btn ${activeTab === 'trending' ? 'active' : ''}`} onClick={() => setActiveTab('trending')}>Ommabop</button>
            <button className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`} onClick={() => setActiveTab('new')}>Yangi qo'shilganlar</button>
          </div>

          <div className="movies-grid">
            {currentMovies.map((movie: any) => (
              <div key={movie.id} className="movie-card-vertical" onClick={() => window.open(movie.videoUrl, '_blank')} style={{cursor: 'pointer'}}>
                <div className="movie-poster">
                  <img src={movie.thumbnailUrl || "https://ui-avatars.com/api/?name=Movie"} alt={movie.title} />
                  <div className="movie-badges">
                    <span className={`language-badge-small en-badge`}>
                      {movie.languageId === 2 ? '🇬🇧 EN' : (movie.languageId === 3 ? '🇷🇺 RU' : 'UZ')}
                    </span>
                    <span className="level-badge">{movie.level}</span>
                  </div>
                  <div className="play-overlay">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '40px', height: '40px' }}>
                      <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.5)"></circle>
                      <polygon points="10 8 16 12 10 16 10 8" fill="white"></polygon>
                    </svg>
                  </div>
                </div>
                <div className="movie-info">
                  <h4 className="movie-title">{movie.title}</h4>
                  <span className="movie-genre">{movie.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoviesPage;

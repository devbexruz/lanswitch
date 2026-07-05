import React, { useState, useEffect } from 'react';
import './MoviesPage.css';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';

const MoviesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const { learningLanguage } = useLanguage();
  const navigate = useNavigate();

  const fetchMovies = async () => {
    try {
      const res = await fetch('/api/media');
      if (res.ok) setMovies(await res.json());
    } catch (err) {
      console.error("Error fetching movies", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/media/categories');
      if (res.ok) setCategories(await res.json());
    } catch (err) {
      console.error("Error fetching categories", err);
    }
  };

  useEffect(() => {
    fetchMovies();
    fetchCategories();
  }, []);

  const targetLanguageId = learningLanguage === 'en' ? 2 : (learningLanguage === 'ru' ? 3 : 1);
  let currentMovies = movies.filter(m => m.languageId === targetLanguageId || m.languageId === 1);

  if (selectedLevels.length > 0) {
    currentMovies = currentMovies.filter(m => selectedLevels.includes(m.level));
  }

  if (selectedCategories.length > 0) {
    currentMovies = currentMovies.filter(m =>
      m.categoryIds && selectedCategories.some((cid: number) => m.categoryIds.includes(cid))
    );
  }

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
  };

  const toggleCategory = (id: number) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await fetch('/api/media/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName.trim() })
    });
    setNewCategoryName('');
    fetchCategories();
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    await fetch(`/api/media/categories/${editingCategory.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingCategory.name })
    });
    setEditingCategory(null);
    fetchCategories();
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm("Bu janrni o'chirishga ishonchingiz komilmi?")) return;
    await fetch(`/api/media/categories/${id}`, { method: 'DELETE' });
    fetchCategories();
    setSelectedCategories(prev => prev.filter(c => c !== id));
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0 }}>Janrlar</h4>
              {/* <button
                onClick={() => setShowCategoryModal(true)}
                style={{
                  background: 'rgba(99,102,241,0.2)',
                  border: '1px solid rgba(99,102,241,0.5)',
                  color: '#a5b4fc',
                  borderRadius: '8px',
                  padding: '3px 10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                + Boshqarish
              </button> */}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {categories.length === 0 && (
                <p style={{ opacity: 0.5, fontSize: '13px' }}>Janrlar yo'q</p>
              )}
              {categories.map(cat => (
                <label key={cat.id} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
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
              <div key={movie.id} className="movie-card-vertical" onClick={() => navigate(`/player/${movie.id}`)} style={{ cursor: 'pointer' }}>
                <div className="movie-poster">
                  <img src={movie.thumbnailUrl || "https://ui-avatars.com/api/?name=Movie"} alt={movie.title} />
                  <div className="movie-badges">
                    <span className={`language-badge-small en-badge`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                      {movie.languageId === 2 ? '🇬🇧 EN' : (movie.languageId === 3 ? '🇷🇺 RU' : 'UZ')}
                    </span>
                    <span className="level-badge">{movie.level}</span>
                    <span className="type-badge" style={{
                      backgroundColor: movie.isFilm ? 'var(--accent-primary)' : '#8b5cf6',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginLeft: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      {movie.isFilm ? 'KINO' : 'SERIAL'}
                    </span>
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
                  <span className="movie-genre" style={{ color: 'var(--text-secondary)' }}>
                    {movie.isFilm
                      ? (movie.durationalMinutes ? movie.durationalMinutes + ' daqiqa' : '')
                      : (movie.episodeCount ? movie.episodeCount + ' ta qism' : 'Qismlar')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '90vw' }}>
            <div className="modal-header">
              <h2>Janrlarni boshqarish</h2>
              <button className="icon-btn" onClick={() => setShowCategoryModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Add new */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Yangi janr nomi..."
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                  Qo'shish
                </button>
              </div>

              {/* List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                    {editingCategory?.id === cat.id ? (
                      <>
                        <input
                          type="text"
                          className="form-control"
                          value={editingCategory.name}
                          onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          style={{ flex: 1 }}
                          autoFocus
                        />
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={handleUpdateCategory}>Saqlash</button>
                        <button className="btn btn-outline-light" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => setEditingCategory(null)}>Bekor</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontWeight: 500 }}>{cat.name}</span>
                        <button
                          onClick={() => setEditingCategory({ ...cat })}
                          style={{ background: 'rgba(99,102,241,0.2)', border: 'none', color: '#a5b4fc', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '13px' }}
                        >
                          Tahrir
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#f87171', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '13px' }}
                        >
                          O'chir
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {categories.length === 0 && (
                  <p style={{ textAlign: 'center', opacity: 0.5 }}>Hali janrlar yo'q</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoviesPage;

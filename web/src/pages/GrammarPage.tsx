import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './GrammarPage.css';
import { useLanguage } from '../context/LanguageContext';
import ReactMarkdown from 'react-markdown';

const GrammarPage: React.FC = () => {
  const [grammarList, setGrammarList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrammar, setSelectedGrammar] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { learningLanguage } = useLanguage();

  // Map language code to languageId (Number() conversion to avoid type mismatch from API)
  const langIdMap: Record<string, number> = { en: 1, ru: 2 };
  const currentLangId = langIdMap[learningLanguage] ?? 1;

  useEffect(() => {
    fetchGrammar();
  }, []);

  const fetchGrammar = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/grammar');
      if (res.ok) {
        const data = await res.json();
        console.log('[GrammarPage] fetched:', data);
        setGrammarList(data);
      } else {
        console.warn('[GrammarPage] fetch failed:', res.status);
      }
    } catch (e) {
      console.error('[GrammarPage] fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredGrammar = grammarList.filter(g => {
    // Use Number() to avoid string/number type mismatch from API response
    const matchesLang = Number(g.languageId) === currentLangId;
    const matchesSearch =
      !searchQuery.trim() ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLang && matchesSearch;
  });

  const totalCount = grammarList.filter(g => Number(g.languageId) === currentLangId).length;

  return (
    <div className="grammar-page animate-fade-in">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Grammatika</h1>
          <p className="page-subtitle">Grammatik qoidalar to'plami</p>
        </div>
        <div className="grammar-stat-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>{totalCount} ta qoida</span>
        </div>
      </div>

      {/* Search */}
      <div className="grammar-search-wrapper">
        <svg className="grammar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="grammar-search-input"
          placeholder="Qoida yoki tavsif bo'yicha qidirish..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="grammar-search-clear" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      {/* Grammar List */}
      {loading ? (
        <div className="grammar-loading">
          <div className="grammar-loading-spinner"></div>
          <p>Yuklanmoqda...</p>
        </div>
      ) : filteredGrammar.length === 0 ? (
        <div className="grammar-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <p>{searchQuery ? 'Qidiruvga mos qoida topilmadi' : 'Hali grammatik qoidalar qo\'shilmagan'}</p>
        </div>
      ) : (
        <div className="grammar-grid">
          {filteredGrammar.map((item: any) => (
            <div
              key={item.id}
              className="grammar-card-new"
              onClick={() => setSelectedGrammar(item)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setSelectedGrammar(item)}
            >
              <div className="grammar-card-new-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="grammar-card-new-body">
                <h3 className="grammar-card-new-name">{item.name}</h3>
                <p className="grammar-card-new-desc">{item.description}</p>
              </div>
              <div className="grammar-card-new-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grammar Detail Modal */}
      {selectedGrammar && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setSelectedGrammar(null)}>
          <div
            className="modal-content grammar-detail-modal animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="grammar-detail-header-info">
                <span className="grammar-detail-tag">
                  {selectedGrammar.languageId === 1 ? '🇬🇧 English' : '🇷🇺 Russian'}
                </span>
                <h2 className="grammar-detail-title">{selectedGrammar.name}</h2>
                <p className="grammar-detail-subtitle">{selectedGrammar.description}</p>
              </div>
              <button className="close-btn" onClick={() => setSelectedGrammar(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body grammar-detail-body">
              <div className="grammar-markdown-content markdown-body">
                <ReactMarkdown>{selectedGrammar.content}</ReactMarkdown>
              </div>

              {selectedGrammar.videoUrl && (
                <div className="grammar-video-link">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                  <a href={selectedGrammar.videoUrl} target="_blank" rel="noopener noreferrer">
                    Video darslikni ko'rish
                  </a>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedGrammar(null)}>
                Yopish
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default GrammarPage;

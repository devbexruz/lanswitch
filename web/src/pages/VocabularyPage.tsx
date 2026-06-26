import React, { useState } from 'react';
import './VocabularyPage.css';
import { useLanguage } from '../context/LanguageContext';

// Mock data
const mockWords: Record<'en' | 'ru', any[]> = {
  en: [
    { id: 1, word: "Diligent", translation: "Tirishqoq", status: "active", lastReviewed: "Bugun" },
    { id: 2, word: "Ephemeral", translation: "O'tkinchi", status: "inactive", lastReviewed: "1 hafta oldin" },
    { id: 3, word: "Eloquent", translation: "Biyron, notiq", status: "active", lastReviewed: "Kecha" },
    { id: 4, word: "Inevitable", translation: "Muqarrar", status: "inactive", lastReviewed: "2 hafta oldin" },
    { id: 5, word: "Tenacious", translation: "Qat'iyatli", status: "active", lastReviewed: "3 kun oldin" },
  ],
  ru: [
    { id: 101, word: "Ответственный", translation: "Javobgar, ma'suliyatli", status: "active", lastReviewed: "Bugun" },
    { id: 102, word: "Мимолетный", translation: "O'tkinchi", status: "inactive", lastReviewed: "1 hafta oldin" },
    { id: 103, word: "Красноречивый", translation: "Notiq", status: "active", lastReviewed: "Kecha" },
  ]
};

const VocabularyPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { learningLanguage } = useLanguage();
  
  const currentWords = mockWords[learningLanguage];

  return (
    <div className="vocabulary-page animate-fade-in">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Mening Lug'atim</h1>
          <p className="page-subtitle">O'rganilgan va takrorlanishi kerak bo'lgan so'zlar</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          + Yangi so'z kashf etish
        </button>
      </div>

      {/* Stats Header */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">1,245</span>
            <span className="stat-label">Jami so'zlar</span>
          </div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(102, 155, 188, 0.2)', color: 'var(--color-steel-blue)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">1,120</span>
            <span className="stat-label">Faol so'zlar</span>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderColor: 'rgba(244, 211, 94, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(244, 211, 94, 0.2)', color: 'var(--color-papaya-whip)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: 'var(--color-papaya-whip)' }}>125</span>
            <span className="stat-label">Faol emas (Takrorlash kerak)</span>
          </div>
          <button className="btn btn-outline-warning small-btn ml-auto">Takrorlash</button>
        </div>
      </div>

      {/* Vocabulary List */}
      <div className="vocabulary-list-container glass-panel">
        <div className="list-controls">
          <input type="text" className="search-input" placeholder="So'z qidirish..." />
          <select className="filter-select">
            <option>Barchasi</option>
            <option>Faol</option>
            <option>Faol emas</option>
          </select>
        </div>

        <table className="vocabulary-table">
          <thead>
            <tr>
              <th>So'z ({learningLanguage === 'en' ? 'Inglizcha' : 'Ruscha'})</th>
              <th>Tarjimasi (O'zbekcha)</th>
              <th>Status</th>
              <th>Oxirgi marta</th>
              <th>Harakatlar</th>
            </tr>
          </thead>
          <tbody>
            {currentWords.map((item, index) => (
              <tr key={item.id || index}>
                <td className="word-cell">{item.word || item.title}</td>
                <td className="translation-cell">{item.translation}</td>
                <td>
                  <span className={`status-badge ${item.status}`}>
                    {item.status === 'active' ? 'Faol' : 'Faol emas'}
                  </span>
                </td>
                <td className="time-cell">{item.lastReviewed}</td>
                <td>
                  <button className="icon-btn-small" title="Tinglash">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Discover New Words Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Yangi so'zlar kashf etish</h2>
              <button className="close-btn" onClick={() => setIsAddModalOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Tizimda mavjud lug'atdan o'zingizga noma'lum so'zlarni tanlang va yodlashni boshlang:
              </p>
              
              <div className="dictionary-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                <div className="dict-item glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'white' }}>{learningLanguage === 'en' ? 'Astonishing' : 'Потрясающий'}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hayratlanarli</span>
                  </div>
                  <button className="btn btn-outline-light small-btn" onClick={() => alert('So\'z lug\'atingizga qo\'shildi!')}>+ Yodlash</button>
                </div>
                
                <div className="dict-item glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'white' }}>{learningLanguage === 'en' ? 'Fascinating' : 'Очаровательный'}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Jozibali, qiziqarli</span>
                  </div>
                  <button className="btn btn-outline-light small-btn" onClick={() => alert('So\'z lug\'atingizga qo\'shildi!')}>+ Yodlash</button>
                </div>

                <div className="dict-item glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'white' }}>{learningLanguage === 'en' ? 'Ubiquitous' : 'Повсеместный'}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Keng tarqalgan, hamma joyda bor</span>
                  </div>
                  <button className="btn btn-outline-light small-btn" onClick={() => alert('So\'z lug\'atingizga qo\'shildi!')}>+ Yodlash</button>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsAddModalOpen(false)}>Yopish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VocabularyPage;

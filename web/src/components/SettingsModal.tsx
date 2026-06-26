import React from 'react';
import './SettingsModal.css';
import { useLanguage } from '../context/LanguageContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { activeLearningLanguages, toggleLearningLanguage, nativeLanguage } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sozlamalar</h2>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="modal-body">
          <section className="settings-section">
            <h3>Asosiy Til</h3>
            <p className="settings-desc">Platformaning interfeysi va barcha tarjimalar shu tilda bo'ladi.</p>
            <div className="select-container">
              <select disabled value={nativeLanguage} className="glass-panel">
                <option value="uz">🇺🇿 O'zbek tili</option>
              </select>
              <span className="fixed-badge">Doimiy</span>
            </div>
          </section>

          <section className="settings-section">
            <h3>O'rganilayotgan Tillar</h3>
            <p className="settings-desc">Qaysi tillarni o'rganmoqchisiz? Kamida bitta tilni tanlashingiz shart.</p>
            
            <div className="language-toggles">
              <div className={`lang-toggle-card glass-panel ${activeLearningLanguages.includes('en') ? 'active' : ''}`}>
                <div className="lang-info">
                  <span className="lang-flag">🇬🇧</span>
                  <span className="lang-name">Ingliz tili</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={activeLearningLanguages.includes('en')} 
                    onChange={() => toggleLearningLanguage('en')}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className={`lang-toggle-card glass-panel ${activeLearningLanguages.includes('ru') ? 'active' : ''}`}>
                <div className="lang-info">
                  <span className="lang-flag">🇷🇺</span>
                  <span className="lang-name">Rus tili</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={activeLearningLanguages.includes('ru')} 
                    onChange={() => toggleLearningLanguage('ru')}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
            
            {activeLearningLanguages.length === 1 && (
              <p className="warning-text">Kamida 1 ta til tanlangan bo'lishi shart.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

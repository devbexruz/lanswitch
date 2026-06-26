import React from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

const AuthModal: React.FC = () => {
  const { showAuthModal, setShowAuthModal } = useAuth();

  if (!showAuthModal) return null;

  // Bot username: @LanswitchBot (O'zingizning botingizni yozishingiz mumkin)
  const botUrl = "https://t.me/lanswitchbot?start=login";

  return (
    <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={() => setShowAuthModal(false)}>✕</button>

        <div className="auth-modal-icon">🔒</div>
        <h2>Tizimga kirish talab etiladi</h2>
        <p>LanSwitch platformasining to'liq imkoniyatlaridan foydalanish (kinolarni ko'rish, so'z o'rganish va grammatika) uchun ro'yxatdan o'ting.</p>

        <div className="auth-modal-actions">
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="telegram-login-btn">
            Telegram orqali kirish
          </a>
          <button className="cancel-btn" onClick={() => setShowAuthModal(false)}>Yopish</button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MagicLoginPage.css';

export default function MagicLoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Tizimga kirilmoqda...');

  const requestSent = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Xatolik: Token topilmadi.');
      return;
    }

    if (requestSent.current) return;
    requestSent.current = true;

    const authenticateToken = async () => {
      try {
        const response = await fetch('/api/auth/magic-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('Muvaffaqiyatli kirdingiz! Sahifaga yo\'naltirilmoqdasiz...');
          login();
          
          setTimeout(() => {
            navigate('/');
          }, 1500);
        } else {
          setStatus('error');
          setMessage(data.message || 'Token muddati tugagan yoki xato.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Server bilan aloqada xatolik yuz berdi.');
      }
    };

    authenticateToken();
  }, [searchParams, navigate, login]);

  return (
    <div className="magic-login-container">
      <div className={`magic-login-card ${status}`}>
        {status === 'loading' && <div className="spinner"></div>}
        {status === 'success' && <div className="icon success-icon">✓</div>}
        {status === 'error' && <div className="icon error-icon">✕</div>}
        
        <h2>{status === 'loading' ? 'Kutib turing' : status === 'success' ? 'Muvaffaqiyatli!' : 'Xatolik'}</h2>
        <p>{message}</p>
        
        {status === 'error' && (
          <button className="back-btn" onClick={() => navigate('/')}>
            Bosh sahifaga qaytish
          </button>
        )}
      </div>
    </div>
  );
}

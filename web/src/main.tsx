import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider } from './context/AuthContext'

// Telegram WebApp Full-Screen & Dynamic Safe-Area synchronization
function initTelegramAndSafeArea() {
  if (typeof window === 'undefined') return;

  const updateSafeArea = () => {
    try {
      const root = document.documentElement;
      const tg = (window as any).Telegram?.WebApp;

      let safeTop = 0;
      let safeBottom = 0;
      let safeLeft = 0;
      let safeRight = 0;

      if (tg) {
        if (tg.safeAreaInset) {
          safeTop = Math.max(safeTop, Number(tg.safeAreaInset.top) || 0);
          safeBottom = Math.max(safeBottom, Number(tg.safeAreaInset.bottom) || 0);
          safeLeft = Math.max(safeLeft, Number(tg.safeAreaInset.left) || 0);
          safeRight = Math.max(safeRight, Number(tg.safeAreaInset.right) || 0);
        }
        if (tg.contentSafeAreaInset) {
          safeTop = Math.max(safeTop, Number(tg.contentSafeAreaInset.top) || 0);
          safeBottom = Math.max(safeBottom, Number(tg.contentSafeAreaInset.bottom) || 0);
          safeLeft = Math.max(safeLeft, Number(tg.contentSafeAreaInset.left) || 0);
          safeRight = Math.max(safeRight, Number(tg.contentSafeAreaInset.right) || 0);
        }
      }

      root.style.setProperty('--tg-safe-top', `${safeTop}px`);
      root.style.setProperty('--tg-safe-bottom', `${safeBottom}px`);
      root.style.setProperty('--tg-safe-left', `${safeLeft}px`);
      root.style.setProperty('--tg-safe-right', `${safeRight}px`);

      root.style.setProperty('--safe-area-top', `max(${safeTop}px, env(safe-area-inset-top, 0px))`);
      root.style.setProperty('--safe-area-bottom', `max(${safeBottom}px, env(safe-area-inset-bottom, 0px))`);
      root.style.setProperty('--safe-area-left', `max(${safeLeft}px, env(safe-area-inset-left, 0px))`);
      root.style.setProperty('--safe-area-right', `max(${safeRight}px, env(safe-area-inset-right, 0px))`);
    } catch (e) {
      console.warn('Safe area update error:', e);
    }
  };

  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready?.();
      tg.expand?.();
      if (typeof tg.requestFullscreen === 'function') {
        tg.requestFullscreen();
      }
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }

      tg.onEvent?.('safeAreaChanged', updateSafeArea);
      tg.onEvent?.('contentSafeAreaChanged', updateSafeArea);
      tg.onEvent?.('fullscreenChanged', updateSafeArea);
      tg.onEvent?.('viewportChanged', updateSafeArea);
    }
  } catch (e) {
    console.warn('Telegram WebApp init warning:', e);
  }

  updateSafeArea();
  window.addEventListener('resize', updateSafeArea);
  window.addEventListener('orientationchange', updateSafeArea);
}

initTelegramAndSafeArea();

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;

  const token = localStorage.getItem('lanswitch_token');
  let user: any = null;
  try {
    const saved = localStorage.getItem('lanswitch_user');
    if (saved) user = JSON.parse(saved);
  } catch {}

  const headers = new Headers(config?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (user?.id && !headers.has('X-User-Id')) {
    headers.set('X-User-Id', user.id.toString());
  }

  const updatedConfig = {
    ...config,
    headers,
  };

  const response = await originalFetch(resource, updatedConfig);
  if (response.status === 401) {
    const url = typeof resource === 'string' ? resource : (resource as Request).url;
    if (url.includes('/api/auth/refresh') || url.includes('/api/auth/logout') || url.includes('/api/auth/magic-login')) {
       return response;
    }
    
    try {
      const refreshRes = await originalFetch('/api/auth/refresh', { method: 'POST' });
      if (refreshRes.ok) {
        return await originalFetch(resource, updatedConfig);
      } else {
        window.dispatchEvent(new Event('auth-failed'));
      }
    } catch (e) {
      window.dispatchEvent(new Event('auth-failed'));
    }
  }
  return response;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
)

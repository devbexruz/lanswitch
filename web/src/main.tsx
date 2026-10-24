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

  const APP_THEME_COLOR = '#2563EB'; // Brand Blue for Top App Bar
  const BOTTOM_NAV_COLOR = '#FFFFFF'; // White for Bottom Navigation Bar
  const APP_BG_COLOR = '#EFF6FF'; // Ice Blue for Page Background

  // 1. Sync mobile browser meta theme-color in JS
  try {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', APP_THEME_COLOR);

    let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!metaApple) {
      metaApple = document.createElement('meta');
      metaApple.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(metaApple);
    }
    metaApple.setAttribute('content', 'black-translucent');
  } catch (e) {
    console.warn('Meta tag update error:', e);
  }

  const applyColors = () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        if (typeof tg.setHeaderColor === 'function') {
          tg.setHeaderColor(APP_THEME_COLOR);
        }
        if (typeof tg.setBackgroundColor === 'function') {
          tg.setBackgroundColor(APP_BG_COLOR);
        }
        if (typeof tg.setBottomBarColor === 'function') {
          tg.setBottomBarColor(BOTTOM_NAV_COLOR);
        }
      }
    } catch (e) {
      console.warn('Telegram set colors warning:', e);
    }
  };

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

      applyColors();
    } catch (e) {
      console.warn('Safe area update error:', e);
    }
  };

  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready?.();
      tg.expand?.();

      applyColors();

      tg.onEvent?.('safeAreaChanged', updateSafeArea);
      tg.onEvent?.('contentSafeAreaChanged', updateSafeArea);
      tg.onEvent?.('fullscreenChanged', () => {
        updateSafeArea();
        applyColors();
      });
      tg.onEvent?.('viewportChanged', () => {
        updateSafeArea();
        applyColors();
      });
    }
  } catch (e) {
    console.warn('Telegram WebApp init warning:', e);
  }

  updateSafeArea();
  applyColors();
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

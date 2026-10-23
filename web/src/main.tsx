import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider } from './context/AuthContext'

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

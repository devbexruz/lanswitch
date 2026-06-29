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
  const response = await originalFetch(...args);
  if (response.status === 401) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    if (url.includes('/api/auth/refresh') || url.includes('/api/auth/logout') || url.includes('/api/auth/magic-login')) {
       return response;
    }
    
    try {
      const refreshRes = await originalFetch('/api/auth/refresh', { method: 'POST' });
      if (refreshRes.ok) {
        // Refresh succeeded, retry original request
        return await originalFetch(...args);
      } else {
        // Refresh failed
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

/**
 * Telegram WebApp Utility Helpers
 */

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).Telegram?.WebApp?.initData || (window as any).Telegram?.WebApp?.version);
}

/**
 * Telegram Desktop / Web muhitida ochilganligini aniqlash
 * Telegram platformalari: 'tdesktop' (Desktop app), 'macos' (macOS native), 'web' / 'weba' / 'webk' (Telegram Web)
 */
export function isTelegramDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = (window as any).Telegram?.WebApp;
  const platform = (tg?.platform || '').toLowerCase();

  // 1. Rasmiy Telegram Desktop & Web platform nomlari
  if (['tdesktop', 'macos', 'web', 'weba', 'webk'].includes(platform)) {
    return true;
  }

  // 2. Agar aniq mobil platforma bo'lsa
  if (['android', 'ios'].includes(platform)) {
    return false;
  }

  // 3. Fallback: Agar platform noma'lum yoki ko'rsatilmagan bo'lsa, desktop UserAgent va ekran o'lchami tekshiriladi
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return !isMobileUA && (window.innerWidth >= 768 || (typeof window.screen !== 'undefined' && window.screen.width >= 768));
}

/**
 * Desktopda Telegram Mini App ochilganda avtomatik ravishda boshidayoq to'liq ekranga yoyish (Full-screen mode)
 */
export function autoFullscreenOnDesktop() {
  if (typeof window === 'undefined') return;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return;

  if (isTelegramDesktop() && typeof tg.requestFullscreen === 'function') {
    try {
      tg.expand?.();
      if (!tg.isFullscreen) {
        tg.requestFullscreen();
      }
    } catch (e) {
      console.warn('Telegram requestFullscreen error:', e);
    }

    // Telegram Desktop ba'zan webview to'liq tayyor bo'lishi uchun ozgina vaqt talab qilishi mumkin
    setTimeout(() => {
      try {
        if (!tg.isFullscreen && typeof tg.requestFullscreen === 'function') {
          tg.requestFullscreen();
        }
      } catch {}
    }, 180);
  }
}

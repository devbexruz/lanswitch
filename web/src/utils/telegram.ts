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

/**
 * Ekranni to'liq qoplash (Fullscreen) va kichiklashtirishni almashtirish (Toggle)
 * - Telegram WebApp API (Mobile & Desktop Bot API 8.0+)
 * - HTML5 DOM Fullscreen API (Desktopda butun kompyuter monitorini to'liq qamrab olish)
 */
export async function toggleAppFullscreen(
  isFullscreen: boolean,
  setIsFullscreen: (val: boolean) => void
) {
  if (typeof window === 'undefined') return;
  const tg = (window as any).Telegram?.WebApp;
  const isDomFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
  const isTgFs = Boolean(tg?.isFullscreen);
  const currentlyFullscreen = isFullscreen || isDomFs || isTgFs;

  if (currentlyFullscreen) {
    // 1. DOM Fullscreen dan chiqish (Agar butun monitor qoplangan bo'lsa)
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen?.();
      }
    } catch (e) {
      console.warn('DOM exitFullscreen error:', e);
    }

    // 2. Telegram WebApp Fullscreen dan chiqish
    try {
      if (tg && typeof tg.exitFullscreen === 'function') {
        tg.exitFullscreen();
      }
    } catch (e) {
      console.warn('tg.exitFullscreen error:', e);
    }

    setIsFullscreen(false);
  } else {
    // 1. Telegram WebApp Fullscreenni chaqirish
    try {
      if (tg) {
        tg.expand?.();
        if (typeof tg.requestFullscreen === 'function') {
          tg.requestFullscreen();
        }
      }
    } catch (e) {
      console.warn('tg.requestFullscreen error:', e);
    }

    // 2. HTML5 DOM Fullscreen API (Telegram Desktop va brauzerlarda butun monitorni qamrab oladi)
    try {
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch (e) {
      // Mobile brauzerlarda agar DOM fullscreen bloklangan bo'lsa, xatolik berishi mumkin
      console.warn('DOM requestFullscreen info:', e);
    }

    setIsFullscreen(true);
  }
}


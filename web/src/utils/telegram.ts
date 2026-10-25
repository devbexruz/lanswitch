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
 * Desktopda Telegram Mini App ochilganda oynani maksimal kengaytirish
 */
export function autoFullscreenOnDesktop() {
  if (typeof window === 'undefined') return;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return;

  // Telegram desktopda oynani maksimal kengaytirish (expand)
  try {
    tg.expand?.();
  } catch (e) {
    console.warn('tg.expand error:', e);
  }
}

/**
 * Ekranni to'liq qoplash (Fullscreen) va kichiklashtirishni almashtirish (Toggle)
 * - Mobile Telegram Mini App: Bot API 8.0 tg.requestFullscreen() & tg.exitFullscreen()
 * - Desktop Telegram & Brauzerlar: HTML5 DOM Fullscreen (Chromium orqali monitor ekranini 100% to'liq qoplab olish)
 */
export function toggleAppFullscreen(
  isFullscreen: boolean,
  setIsFullscreen: (val: boolean) => void
) {
  if (typeof window === 'undefined') return;
  const tg = (window as any).Telegram?.WebApp;
  const platform = (tg?.platform || '').toLowerCase();
  const isMobile = ['android', 'ios'].includes(platform) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  if (isMobile) {
    // 1. MOBIL MUHIT (Telegram Mini App Bot API 8.0)
    try {
      if (tg) {
        const currentlyFs = tg.isFullscreen ?? isFullscreen;
        if (currentlyFs) {
          tg.exitFullscreen?.();
          setIsFullscreen(false);
        } else {
          tg.requestFullscreen?.();
          tg.expand?.();
          setIsFullscreen(true);
        }
      } else {
        setIsFullscreen(!isFullscreen);
      }
    } catch (e) {
      console.warn('Mobile tg fullscreen error:', e);
    }
  } else {
    // 2. DESKTOP MUHIT (Telegram Desktop ilovasi va oddiy brauzerlar)
    // HTML5 DOM Fullscreen butun kompyuter monitorini 100% to'liq qamrab oladi
    const isDomFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);

    if (isDomFs) {
      // Monitor to'liq ekranidan chiqish
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } catch (e) {
        console.warn('DOM exitFullscreen error:', e);
      }

      try {
        if (tg && typeof tg.exitFullscreen === 'function') {
          tg.exitFullscreen();
        }
      } catch {}

      setIsFullscreen(false);
    } else {
      // Monitor to'liq ekranini qoplab olish (1920x1080 true fullscreen)
      try {
        const el = document.documentElement as any;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch((err: any) => console.warn('DOM requestFullscreen error:', err));
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } catch (e) {
        console.warn('DOM requestFullscreen exception:', e);
      }

      try {
        if (tg) {
          tg.expand?.();
          if (typeof tg.requestFullscreen === 'function') {
            tg.requestFullscreen();
          }
        }
      } catch {}

      setIsFullscreen(true);
    }
  }
}

/**
 * Telegram WebApp BackButton boshqarish
 * - showTelegramBackButton(callback): Telegram chap yuqoridagi 'X' ni '<-' ga aylantiradi va bosilganda callback chaqiradi
 * - hideTelegramBackButton(): '<-' tugmasini yashirib, qaytadan 'X' ga aylantiradi
 */
let currentBackHandler: (() => void) | null = null;

export function showTelegramBackButton(onClick: () => void) {
  if (typeof window === 'undefined') return;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.BackButton) return;

  try {
    if (currentBackHandler) {
      tg.BackButton.offClick(currentBackHandler);
    }
    currentBackHandler = () => {
      try {
        onClick();
      } catch (err) {
        console.error('BackButton callback error:', err);
      }
    };
    tg.BackButton.onClick(currentBackHandler);
    tg.BackButton.show();
  } catch (e) {
    console.warn('Telegram BackButton show error:', e);
  }
}

export function hideTelegramBackButton() {
  if (typeof window === 'undefined') return;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.BackButton) return;

  try {
    if (currentBackHandler) {
      tg.BackButton.offClick(currentBackHandler);
      currentBackHandler = null;
    }
    tg.BackButton.hide();
  } catch (e) {
    console.warn('Telegram BackButton hide error:', e);
  }
}

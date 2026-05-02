'use client';

import { useEffect } from 'react';
import { bootstrapDesktopAdapters } from '@/lib/platformBootstrap';

/**
 * Desktop 환경 감지 + 어댑터 주입 + platform-aware CSS class.
 * Electron preload 가 window.balruno 를 노출했을 때만 동작 (web 에서는 no-op).
 *
 * 추가 동작: html.classList 에 'platform-electron' / 'platform-electron-mac' 등 부여 →
 * globals.css 가 Mac traffic lights 자리만큼 사이드바 좌측 상단 padding 추가.
 *
 * layout.tsx 의 body 최상단에 mount.
 */
export function DesktopBootstrap() {
  useEffect(() => {
    bootstrapDesktopAdapters();
    if (typeof window === 'undefined') return;
    if (!window.balruno?.isDesktop) return;

    const html = document.documentElement;
    html.classList.add('platform-electron');
    // Mac 감지 — userAgent / platform
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (isMac) html.classList.add('platform-electron-mac');
  }, []);
  return null;
}

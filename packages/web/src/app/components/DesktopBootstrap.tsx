'use client';

import { useEffect } from 'react';
import { bootstrapDesktopAdapters } from '@/lib/platformBootstrap';

/**
 * Desktop 환경 감지 + 어댑터 주입.
 * Electron preload 가 window.balruno 를 노출했을 때만 동작 (web 에서는 no-op).
 *
 * layout.tsx 의 body 최상단에 mount.
 */
export function DesktopBootstrap() {
  useEffect(() => {
    bootstrapDesktopAdapters();
  }, []);
  return null;
}

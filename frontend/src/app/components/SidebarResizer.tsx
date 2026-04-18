'use client';

/**
 * Sidebar 좌측 폭 리사이저. DockedToolbox 우측 리사이저와 일관된 스타일.
 */

import { useRef } from 'react';
import { useToolLayoutStore } from '@/stores/toolLayoutStore';

const MIN_W = 180;
const MAX_W = 500;

export default function SidebarResizer() {
  const setSidebarWidth = useToolLayoutStore((s) => s.setSidebarWidth);
  const activeRef = useRef(false);

  const handleStart = (e: React.PointerEvent) => {
    e.preventDefault();
    activeRef.current = true;
    const onMove = (ev: PointerEvent) => {
      if (!activeRef.current) return;
      const w = Math.max(MIN_W, Math.min(MAX_W, ev.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      activeRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      onPointerDown={handleStart}
      className="hidden md:block w-1.5 cursor-col-resize hover:bg-[var(--accent)] transition-colors flex-shrink-0"
      style={{ touchAction: 'none' }}
      role="separator"
      aria-label="Resize sidebar"
    />
  );
}

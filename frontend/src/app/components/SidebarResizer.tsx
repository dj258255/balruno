'use client';

/**
 * Sidebar 좌측 폭 리사이저. DockedToolbox 우측 리사이저와 일관된 스타일.
 *
 * delta-based 계산 — 사이드바가 화면 좌측 0 에서 시작하지 않거나
 * (모바일 오버레이, offset) 스크롤 상황에서도 정확히 동작.
 * visible 은 얇게(w-1) 유지하되 ::before 로 hit area 를 넓혀(좌우 각 4px)
 * 잡기 쉽게 만듦.
 */

import { useRef } from 'react';
import { useToolLayoutStore } from '@/stores/toolLayoutStore';

export default function SidebarResizer() {
  const setSidebarWidth = useToolLayoutStore((s) => s.setSidebarWidth);
  const sidebarWidth = useToolLayoutStore((s) => s.sidebarWidth);
  const activeRef = useRef(false);

  const handleStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activeRef.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: PointerEvent) => {
      if (!activeRef.current) return;
      setSidebarWidth(startW + (ev.clientX - startX));
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
      className="hidden md:block relative w-1 cursor-col-resize flex-shrink-0 group"
      style={{ touchAction: 'none' }}
      role="separator"
      aria-label="사이드바 폭 조절"
      aria-orientation="vertical"
    >
      {/* 넓은 hit area (보이지 않음, 좌우 각 4px 씩 hover 영역 확장) */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
      {/* 시각적 표시 — hover 시 accent */}
      <div className="absolute inset-0 transition-colors group-hover:bg-[var(--accent)]" />
    </div>
  );
}

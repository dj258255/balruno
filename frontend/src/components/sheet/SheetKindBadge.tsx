'use client';

import type { Sheet } from '@/types';
import { resolveSheetKind } from '@/lib/sheetKind';

interface SheetKindBadgeProps {
  sheet: Sheet;
  /** game-data 는 기본값이라 숨김이 기본. true 로 주면 항상 표시. */
  showDefault?: boolean;
  /** "auto" = 자동 감지인 경우 약간 흐리게 표시. */
  dimAuto?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
}

export function SheetKindBadge({
  sheet,
  showDefault = false,
  dimAuto = true,
  size = 'xs',
  className = '',
}: SheetKindBadgeProps) {
  const meta = resolveSheetKind(sheet);
  if (meta.kind === 'game-data' && !showDefault) return null;

  const isAuto = meta.source !== 'manual';
  const paddingClass = size === 'xs' ? 'px-1 py-[1px] text-[9px]' : 'px-1.5 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center rounded font-medium uppercase tracking-wider shrink-0 ${paddingClass} ${className}`}
      style={{
        background: `${meta.color}22`,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
        opacity: dimAuto && isAuto ? 0.75 : 1,
      }}
      title={`${meta.label} — ${meta.description}${isAuto ? ' (자동 감지)' : ''}`}
    >
      {meta.label}
    </span>
  );
}

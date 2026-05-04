import { useTranslations } from 'next-intl';
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
  /** 부모 행이 강조 배경(짙은 색)일 때 — 흰 배경으로 뒤집어서 가독성 확보. */
  onAccent?: boolean;
}

export function SheetKindBadge({
  sheet,
  showDefault = false,
  dimAuto = true,
  size = 'xs',
  className = '',
  onAccent = false,
}: SheetKindBadgeProps) {
  const t = useTranslations();
  const meta = resolveSheetKind(sheet);
  if (meta.kind === 'game-data' && !showDefault) return null;

  const isAuto = meta.source !== 'manual';
  const paddingClass = size === 'xs' ? 'px-1 py-[1px] text-caption' : 'px-1.5 py-0.5 text-caption';

  const style = onAccent
    ? {
        background: '#ffffff',
        color: meta.color,
        border: `1px solid ${meta.color}`,
        opacity: dimAuto && isAuto ? 0.9 : 1,
      }
    : {
        background: `${meta.color}22`,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
        opacity: dimAuto && isAuto ? 0.75 : 1,
      };

  return (
    <span
      className={`inline-flex items-center rounded font-medium uppercase tracking-wider shrink-0 ${paddingClass} ${className}`}
      style={style}
      title={t('sheet.kindBadgeTitle', { label: meta.label, desc: meta.description, auto: isAuto ? t('sheet.kindAutoSuffix') : '' })}
    >
      {meta.label}
    </span>
  );
}

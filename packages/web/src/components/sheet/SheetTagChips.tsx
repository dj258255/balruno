import type { Sheet } from '@/types';

interface SheetTagChipsProps {
  sheet: Sheet;
  /** 표시 최대 개수. 초과분은 +N 으로 압축 (사이드바 공간 절약). */
  max?: number;
  /** 부모 행이 강조 배경(짙은 색)일 때 — 흰 배경으로 반전. */
  onAccent?: boolean;
}

/**
 * 시트 태그 inline chip 표시 (사이드바 시트 행 등).
 *  - 다중 tag 중 max 개까지만 chip, 나머지는 "+N" 으로 응축
 *  - 클릭/편집 없음 — 순수 표시. 편집은 컨텍스트 메뉴 → SheetTagsModal.
 */
export function SheetTagChips({ sheet, max = 2, onAccent = false }: SheetTagChipsProps) {
  const tags = sheet.tags ?? [];
  if (tags.length === 0) return null;

  const visible = tags.slice(0, max);
  const hidden = tags.length - visible.length;

  const chipStyle = onAccent
    ? {
        background: '#ffffff',
        color: 'var(--accent)',
        border: '1px solid var(--accent)',
      }
    : {
        background: 'var(--bg-tertiary)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-secondary)',
      };

  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" title={tags.join(', ')}>
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-1 py-[1px] rounded text-[10px] font-medium max-w-[80px] truncate"
          style={chipStyle}
        >
          {tag}
        </span>
      ))}
      {hidden > 0 && (
        <span
          className="inline-flex items-center px-1 py-[1px] rounded text-[10px] font-medium"
          style={chipStyle}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
}

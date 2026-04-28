'use client';

import { ReactNode, useState, useEffect } from 'react';
import { X, LucideIcon, Move, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PanelHeaderProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  color: string;
  onClose?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  // 추가 콘텐츠 (도움말 버튼, 배지 등)
  extraContent?: ReactNode;
}

// 드래그 힌트가 표시되었는지 확인
const DRAG_HINT_KEY = 'balruno-drag-hint-shown';

export default function PanelHeader({
  title,
  description,
  icon: Icon,
  color,
  onClose,
  onDragStart,
  extraContent,
}: PanelHeaderProps) {
  const t = useTranslations();
  const [showDragHint, setShowDragHint] = useState(false);

  useEffect(() => {
    // 첫 방문자에게만 힌트 표시
    if (typeof window !== 'undefined') {
      const hintShown = localStorage.getItem(DRAG_HINT_KEY);
      if (!hintShown) {
        setShowDragHint(true);
        // 5초 후 자동 숨김
        const timer = setTimeout(() => {
          setShowDragHint(false);
          localStorage.setItem(DRAG_HINT_KEY, 'true');
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 버튼, input, select 등 상호작용 요소는 제외
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) {
      return;
    }
    // 힌트 숨기고 저장
    if (showDragHint) {
      setShowDragHint(false);
      localStorage.setItem(DRAG_HINT_KEY, 'true');
    }
    if (onDragStart) {
      onDragStart(e);
    }
  };

  return (
    <div
      className="glass-panel-header flex items-center gap-3 px-4 py-3 relative z-20 cursor-grab active:cursor-grabbing shrink-0"
      style={{
        background: `${color}08`,
        borderBottom: `1px solid ${color}20`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 드래그 핸들 - 미니멀 디자인 */}
      <div
        className="flex items-center justify-center w-5 opacity-40 hover:opacity-70 transition-opacity"
        title={t('panel.dragToMove')}
      >
        <GripVertical className="w-4 h-4" style={{ color }} />
      </div>

      {/* 아이콘 컨테이너 */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform hover:scale-105"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color }} />
      </div>

      {/* 제목 & 설명 */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        {description && (
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {description}
          </p>
        )}
      </div>

      {/* 우측 액션 영역 */}
      <div className="flex items-center gap-1 shrink-0">
        {extraContent}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-[var(--bg-hover)] opacity-60 hover:opacity-100"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label={t('panel.closeAria')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 첫 사용자 드래그 힌트 */}
      {showDragHint && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fadeIn z-50"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          <Move className="w-4 h-4" style={{ color }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('panel.dragHint')}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDragHint(false);
              localStorage.setItem(DRAG_HINT_KEY, 'true');
            }}
            className="text-xs px-1.5 py-0.5 rounded ml-1 hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('panel.confirm')}
          </button>
        </div>
      )}
    </div>
  );
}

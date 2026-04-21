'use client';

/**
 * PanelShell — 모든 도구 패널의 표준 컨테이너.
 *
 * 책임:
 *  - 헤더 (아이콘 + 제목 + 선택적 subtitle + 닫기)
 *  - 스크롤 가능한 본문 영역
 *  - 선택적 푸터 (CTA 버튼)
 *  - Escape 키로 닫기 (useEscapeKey)
 *
 * 적용: AutoBalancer / LootSimulator / PowerCurveCompare / Comments /
 *       InterfaceDesigner / Automations 6개 패널.
 */

import { ReactNode } from 'react';
import { X, HelpCircle, type LucideIcon } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface PanelShellProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  onClose: () => void;
  /** 상단 메타 (배지 등) */
  headerExtra?: ReactNode;
  /** 닫기 버튼 왼쪽 우측 액션 슬롯 (도움말 등) */
  actions?: ReactNode;
  /** 본문 (스크롤 가능) */
  children: ReactNode;
  /** 하단 고정 푸터 (CTA 등) */
  footer?: ReactNode;
  /** body padding 커스텀 (기본 p-3) */
  bodyClassName?: string;
}

export default function PanelShell({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'var(--accent)',
  onClose,
  headerExtra,
  actions,
  children,
  footer,
  bodyClassName = 'p-3 space-y-3',
}: PanelShellProps) {
  useEscapeKey(onClose);

  return (
    <div className="flex flex-col h-full" role="region" aria-label={title}>
      <div
        className="flex items-center justify-between p-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={16} style={{ color: iconColor, flexShrink: 0 }} />}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerExtra}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
            aria-label="패널 닫기"
          >
            <X size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

      {footer && (
        <div
          className="flex-shrink-0 border-t p-2"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * 패널 헤더용 도움말 토글 버튼. PanelShell `actions` 슬롯에 전달.
 * active 상태에 따라 색상 전환.
 */
export function HelpToggle({
  active,
  onToggle,
  color = 'var(--accent)',
}: {
  active: boolean;
  onToggle: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
      aria-label={active ? '도움말 숨기기' : '도움말 보기'}
      aria-pressed={active}
      title={active ? '도움말 숨기기' : '도움말 보기'}
    >
      <HelpCircle
        size={14}
        style={{ color: active ? color : 'var(--text-secondary)' }}
      />
    </button>
  );
}

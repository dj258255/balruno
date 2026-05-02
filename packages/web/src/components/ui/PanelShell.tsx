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

import { ReactNode, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEscapeKey } from '@/hooks/useEscapeKey';

/**
 * PanelShellContext — DockedToolbox / BottomDock 안에서 열린 PanelShell 은
 * 자체 헤더를 숨김. 상단 dock 이 이미 아이콘+제목+설명+닫기 다 표시하므로.
 *
 * 사용: DockedToolbox 에서 `<PanelShellContext.Provider value={{ hideHeader: true, actionsSlot }}>` 로 감쌈.
 *
 *  - actionsSlot: 지정 시 Panel 의 actions/headerExtra 를 portal 로 그 영역에 렌더.
 *    hideHeader 일 때 dock 의 X 버튼 옆에 도움말 등 액션을 자연스럽게 배치하려는 용도.
 */
export interface PanelShellContextValue {
  hideHeader: boolean;
  /** actions/headerExtra 를 portal 로 렌더할 DOM 노드. null 이면 floating bar 로 fallback. */
  actionsSlot?: HTMLElement | null;
}

export const PanelShellContext = createContext<PanelShellContextValue>({
  hideHeader: false,
  actionsSlot: null,
});

interface PanelShellProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  /** 아이콘 슬롯을 커스텀 노드로 교체 (예: 이모지 피커). 지정 시 icon prop 무시. */
  iconNode?: ReactNode;
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
  /** 헤더 숨김 override — context 값 무시하고 강제 숨김. */
  hideHeader?: boolean;
}

export default function PanelShell({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'var(--accent)',
  iconNode,
  onClose,
  headerExtra,
  actions,
  children,
  footer,
  bodyClassName = 'p-3 space-y-3',
  hideHeader,
}: PanelShellProps) {
  const t = useTranslations('ui');
  useEscapeKey(onClose);

  // Context 값을 읽어 hideHeader 결정. prop 이 명시되면 그 값 우선.
  const ctx = useContext(PanelShellContext);
  const shouldHideHeader = hideHeader ?? ctx.hideHeader;

  // hideHeader 시 처리 3 단계:
  //  1. dock 에서 actionsSlot 을 제공하면 → portal 로 거기에 렌더 (자연스러움)
  //  2. slot 은 없지만 actions/headerExtra 있으면 → 본문 위 floating bar
  //  3. 아무것도 없으면 생략
  const hasFloatingActions =
    shouldHideHeader && !ctx.actionsSlot && (actions || headerExtra);
  const shouldPortalActions =
    shouldHideHeader && ctx.actionsSlot && (actions || headerExtra);

  return (
    <div className="flex flex-col h-full" role="region" aria-label={title}>
      {!shouldHideHeader && (
        <div
          className="flex items-center justify-between p-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {iconNode ?? (Icon && <Icon size={16} style={{ color: iconColor, flexShrink: 0 }} />)}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              {subtitle && (
                <p className="text-caption truncate" style={{ color: 'var(--text-secondary)' }}>
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
              aria-label={t('closePanel')}
            >
              <X size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      )}

      {hasFloatingActions && (
        <div
          className="flex items-center justify-end gap-1 px-3 py-1.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {headerExtra}
          {actions}
        </div>
      )}

      {shouldPortalActions && ctx.actionsSlot && createPortal(
        <>
          {headerExtra}
          {actions}
        </>,
        ctx.actionsSlot,
      )}

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
  const t = useTranslations('ui');
  return (
    <button
      onClick={onToggle}
      className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
      aria-label={active ? t('helpHide') : t('helpShow')}
      aria-pressed={active}
      title={active ? t('helpHide') : t('helpShow')}
    >
      <HelpCircle
        size={14}
        style={{ color: active ? color : 'var(--text-secondary)' }}
      />
    </button>
  );
}

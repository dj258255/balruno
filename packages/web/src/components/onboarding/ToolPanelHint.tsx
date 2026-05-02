'use client';

/**
 * ToolPanelHint — 각 도구 패널 첫 사용 시 1회 안내.
 *
 * 사용처: Calculator, FormulaHelper, BalanceAnalysis, ImbalanceDetector, EconomyWorkbench 등
 * 각 도구 컴포넌트가 자기 toolId 와 안내 컨텐츠를 prop 으로 전달.
 *
 * 동작:
 *  - localStorage 'balruno:tool-hint:{toolId}-seen' 확인 → 안 봤으면 표시
 *  - 사용자가 X 또는 "이해했어요" 클릭 시 dismiss + 영구 마킹
 *  - 패널 본문 위쪽에 inline 카드 (modal 아님) — 사용자가 안 닫아도 도구 사용 방해 X
 */

import { useState, useEffect, type ReactNode } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  /** 고유 식별자 — localStorage 키. 같은 toolId 면 1회만 표시. */
  toolId: string;
  title: string;
  /** 본문. ReactNode 라 list/code/strong 등 자유 마크업. */
  children: ReactNode;
  /** 액센트 색상 — 도구 그룹 색과 매칭. 기본 var(--accent). */
  accentColor?: string;
}

export default function ToolPanelHint({ toolId, title, children, accentColor }: Props) {
  const t = useTranslations('onboarding');
  const [show, setShow] = useState(false);
  const accent = accentColor ?? 'var(--accent)';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(`balruno:tool-hint:${toolId}-seen`);
    if (!seen) setShow(true);
  }, [toolId]);

  const dismiss = () => {
    setShow(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`balruno:tool-hint:${toolId}-seen`, '1');
    }
  };

  if (!show) return null;

  return (
    <div
      className="rounded-lg p-3 mb-3 relative animate-slideDown"
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${accent}`,
      }}
      role="region"
      aria-label={t('toolHintAriaLabel', { title })}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
        aria-label={t('toolHintDismissAria')}
      >
        <X className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
      </button>
      <div className="flex items-start gap-2 pr-6">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: `${accent}1a`, color: accent }}
        >
          <Lightbulb className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {title}
          </div>
          <div className="text-caption space-y-1" style={{ color: 'var(--text-secondary)' }}>
            {children}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 text-caption font-medium px-2 py-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: accent }}
          >
            {t('toolHintGotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}

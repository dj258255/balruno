'use client';

/**
 * StarterCoachmark — 활성 프로젝트의 starter 종류에 맞춘 단계별 가이드.
 *
 * 동작:
 *  - 프로젝트 변경 시 그 프로젝트의 starterId 로 STARTER_CATALOG 매칭 → coachmarkSteps 사용
 *  - 진행 상태는 starter id 별로 분리 저장 ('balruno:coachmark-step:{starterId}')
 *  - 'done' 저장된 starter 는 다시 표시 X (사용자가 마침표 눌렀거나 X 닫음)
 *  - starterId 없는 프로젝트 (수동 생성) 는 coachmark X
 *
 * 위치: 화면 우하단 floating card. 다른 부분 가리지 않음.
 */

import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, X, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { STARTER_CATALOG, COMMON_STEPS_KEY, COMMON_STEPS_COUNT, getStepKeys } from '@/lib/starterPack';

const stepKey = (starterId: string) => `balruno:coachmark-step:${starterId}`;

export default function StarterCoachmark() {
  const t = useTranslations('onboarding');
  const tStarter = useTranslations('starterPack');
  const currentProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId),
  );
  const starterId = currentProject?.starterId ?? null;

  const entry = useMemo(
    () => (starterId ? STARTER_CATALOG.find((e) => e.id === starterId) : null),
    [starterId],
  );
  const stepCount = entry?.stepCount ?? COMMON_STEPS_COUNT;
  const stepsRoot = entry?.stepsI18nKey ?? entry?.i18nKey ?? COMMON_STEPS_KEY;

  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !starterId) {
      setShow(false);
      return;
    }
    const stored = window.localStorage.getItem(stepKey(starterId));
    if (stored === 'done') {
      setShow(false);
      return;
    }
    const startAt = stored ? Math.max(0, Math.min(stepCount - 1, parseInt(stored, 10) || 0)) : 0;
    setStep(startAt);
    setShow(true);
  }, [starterId, stepCount]);

  // step 변경 시 persist
  useEffect(() => {
    if (!show || !starterId) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(stepKey(starterId), String(step));
    }
  }, [step, show, starterId]);

  const close = () => {
    setShow(false);
    if (typeof window !== 'undefined' && starterId) {
      window.localStorage.setItem(stepKey(starterId), 'done');
    }
  };

  const next = () => {
    if (step < stepCount - 1) setStep(step + 1);
    else close();
  };

  if (!show || !entry) return null;
  const { titleKey, bodyKey, actionKey } = getStepKeys(stepsRoot, step);
  const isLast = step === stepCount - 1;
  const Icon = entry.icon;
  const entryLabel = tStarter(`${entry.i18nKey}.label`);

  return (
    <div
      className="fixed bottom-[180px] right-4 sm:bottom-6 sm:right-6 z-[1000] w-80 max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl border overflow-hidden animate-slideUp"
      style={{
        background: 'var(--bg-primary)',
        borderColor: entry.color,
      }}
      role="dialog"
      aria-label={t('coachmarkAriaLabel', { name: entryLabel })}
    >
      <div className="h-1" style={{ background: 'var(--bg-tertiary)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${((step + 1) / stepCount) * 100}%`,
            background: entry.color,
          }}
        />
      </div>

      {/* Header — 장르 아이콘 + 라벨 */}
      <div className="flex items-start gap-2 p-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${entry.color}20`, color: entry.color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {tStarter(titleKey)}
          </div>
          <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('coachmarkStepInfo', { label: entryLabel, current: step + 1, total: stepCount })}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
          aria-label={t('coachmarkClose')}
        >
          <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {tStarter(bodyKey)}
        </p>
        <div
          className="text-caption px-2 py-1.5 rounded-md font-mono"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            borderLeft: `3px solid ${entry.color}`,
          }}
        >
          → {tStarter(actionKey)}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between p-2 border-t"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
      >
        <button
          type="button"
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="text-caption px-2 py-1 rounded transition-colors disabled:opacity-30 hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('prev')}
        </button>
        <button
          type="button"
          onClick={next}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
          style={{ background: entry.color, color: 'white' }}
        >
          {isLast ? (
            <>
              <Check className="w-3 h-3" /> {t('done')}
            </>
          ) : (
            <>
              {t('next')} <ChevronRight className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

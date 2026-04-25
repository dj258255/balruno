'use client';

/**
 * StarterCoachmark — starter seed 사용자에게 한 번에 한 단계씩 안내.
 *
 * 위치: 화면 우하단 floating card. 화면 다른 부분 가리지 않음.
 * 진행: localStorage 'balruno:coachmark-step' 으로 다음 진입 시 이어감.
 * 종료: 사용자가 닫거나 마지막 단계 완료 시.
 *
 * 단계는 자동 진행이 아닌 "체크" 식 — 사용자가 그 행동을 한 후 "다음" 누름.
 * 강제 spotlight/오버레이 X — 학습 강제하지 않고 가벼운 가이드.
 */

import { useState, useEffect } from 'react';
import { ChevronRight, X, Sparkles, Check } from 'lucide-react';

const STORAGE_KEY = 'balruno:coachmark-step';
const STARTER_KEY = 'balruno:starter-seeded';

interface Step {
  title: string;
  body: string;
  /** 사용자에게 시키는 행동 한 줄 */
  action: string;
}

const STEPS: Step[] = [
  {
    title: '환영합니다 — 30초 투어',
    body: '캐릭터 (예시) 시트가 이미 열려 있어요. 셀을 클릭해서 값을 바꿔 보세요.',
    action: '아무 셀이나 클릭 → 편집',
  },
  {
    title: '수식 자동완성',
    body: '셀에 = 입력 → 함수 자동완성 popover. =DAMAGE(공격력, 방어력) 같은 게 가능합니다.',
    action: '빈 셀에 = 입력해보기',
  },
  {
    title: '슬래시 명령',
    body: '일반 셀에 / 입력하면 빠른 명령. /today /uuid /random 등을 골라 보세요.',
    action: '빈 셀에 / 입력',
  },
  {
    title: '한 행으로 시뮬',
    body: '캐릭터 시트의 한 행을 우클릭 → "이 행으로 시뮬 실행". 시뮬 패널이 자동으로 열려요.',
    action: '행 우클릭 → 시뮬 실행',
  },
  {
    title: '단축키',
    body: '? 키 누르면 전체 단축키. ⌘K 로 빠른 검색. G/F/K/C/Y/T 로 뷰 전환.',
    action: '? 눌러서 단축키 도움말 열기',
  },
];

export default function StarterCoachmark() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  // mount 시 starter 사용자인지 + 진행 중인 step 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seeded = window.localStorage.getItem(STARTER_KEY);
    if (seeded !== '1') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const startAt = stored ? Math.max(0, Math.min(STEPS.length - 1, parseInt(stored, 10) || 0)) : 0;
    if (stored === 'done') return;
    setStep(startAt);
    setShow(true);
  }, []);

  // step 변경 시 persist
  useEffect(() => {
    if (!show) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(step));
    }
  }, [step, show]);

  const close = () => {
    setShow(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'done');
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else close();
  };

  if (!show) return null;
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed bottom-[180px] right-4 sm:bottom-6 sm:right-6 z-[1000] w-80 max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl border overflow-hidden animate-slideUp"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--accent)',
      }}
      role="dialog"
      aria-label="첫 사용자 가이드"
    >
      {/* Progress bar */}
      <div className="h-1" style={{ background: 'var(--bg-tertiary)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: 'var(--accent)',
          }}
        />
      </div>

      {/* Header */}
      <div className="flex items-start gap-2 p-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent)15', color: 'var(--accent)' }}
        >
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {cur.title}
          </div>
          <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            단계 {step + 1} / {STEPS.length}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="가이드 닫기"
        >
          <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {cur.body}
        </p>
        <div
          className="text-caption px-2 py-1.5 rounded-md font-mono"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            borderLeft: '3px solid var(--accent)',
          }}
        >
          → {cur.action}
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
          이전
        </button>
        <button
          type="button"
          onClick={next}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {isLast ? (
            <>
              <Check className="w-3 h-3" /> 완료
            </>
          ) : (
            <>
              다음 <ChevronRight className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

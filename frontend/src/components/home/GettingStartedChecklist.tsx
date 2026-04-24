'use client';

/**
 * Home 상단 Getting-started 체크리스트.
 *
 * 5 단계:
 *   1. 첫 프로젝트 만들기 (자동 감지)
 *   2. 수식 컬럼 추가 (자동 감지)
 *   3. 뷰 전환 (자동 감지)
 *   4. 시뮬 돌리기 (수동 체크)
 *   5. Export (수동 체크)
 *
 * dismiss 하면 영구 숨김 (localStorage). 전 항목 완료 시 자동으로 스스로 닫힘.
 */

import { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, Circle, X, ArrowRight } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';

const DISMISS_KEY = 'balruno:getting-started-dismissed';
const MANUAL_KEY = 'balruno:getting-started-manual';

interface ManualChecks {
  sim: boolean;
  export: boolean;
}

function readManual(): ManualChecks {
  if (typeof window === 'undefined') return { sim: false, export: false };
  try {
    const raw = window.localStorage.getItem(MANUAL_KEY);
    if (!raw) return { sim: false, export: false };
    const parsed = JSON.parse(raw) as Partial<ManualChecks>;
    return { sim: !!parsed.sim, export: !!parsed.export };
  } catch {
    return { sim: false, export: false };
  }
}

function writeManual(value: ManualChecks) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MANUAL_KEY, JSON.stringify(value));
}

export function GettingStartedChecklist() {
  const projects = useProjectStore((s) => s.projects);

  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState<ManualChecks>({ sim: false, export: false });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    setManual(readManual());
    setHydrated(true);
  }, []);

  const toggleManual = (key: keyof ManualChecks) => {
    setManual((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeManual(next);
      return next;
    });
  };

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    setDismissed(true);
  };

  const hasProject = projects.length > 0;
  const hasFormulaColumn = useMemo(
    () =>
      projects.some((p) =>
        p.sheets.some((s) => s.columns.some((c) => c.type === 'formula' || !!c.formula)),
      ),
    [projects],
  );
  const hasViewSwitch = useMemo(
    () =>
      projects.some((p) =>
        p.sheets.some((s) => s.activeView !== undefined && s.activeView !== 'grid'),
      ),
    [projects],
  );

  const steps = [
    { id: 'project', label: '첫 프로젝트 만들기', done: hasProject, hint: '샘플 카드에서 바로 시작 가능' },
    { id: 'formula', label: '수식 컬럼 추가', done: hasFormulaColumn, hint: '컬럼 헤더 → + 아이콘 → formula 타입' },
    { id: 'view', label: 'Kanban / Gantt 뷰 전환', done: hasViewSwitch, hint: '시트 상단 View 스위처' },
    { id: 'sim', label: '시뮬 한 번 돌려보기', done: manual.sim, hint: '우측 도구 → Monte Carlo / Goal Solver', manual: true as const },
    { id: 'export', label: 'Unity / JSON Export', done: manual.export, hint: '시트 상단 메뉴 → Export', manual: true as const },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  if (!hydrated || dismissed || allDone) return null;

  return (
    <div
      className="rounded-xl p-4 border relative overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--bg-hover)]"
        aria-label="닫기"
        title="영구 숨김"
      >
        <X className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
      </button>

      <div className="flex items-baseline justify-between gap-4 mb-3 pr-8">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            시작 가이드
          </h3>
          <p className="text-caption mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            5 단계로 기본 기능 체험
          </p>
        </div>
        <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
          {doneCount}/{steps.length} · {pct}%
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div
        className="h-1 rounded-full mb-3 overflow-hidden"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #3b82f6, #10b981)',
          }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : Circle;
          const clickable = 'manual' in step && step.manual;
          return (
            <li
              key={step.id}
              className="flex items-start gap-2.5"
              style={{ opacity: step.done ? 0.6 : 1 }}
            >
              <button
                type="button"
                onClick={clickable ? () => toggleManual(step.id as keyof ManualChecks) : undefined}
                disabled={!clickable}
                className="shrink-0 mt-0.5"
                style={{
                  cursor: clickable ? 'pointer' : 'default',
                }}
                title={clickable ? '수동 체크' : '자동 감지'}
              >
                <Icon
                  className="w-4 h-4"
                  style={{
                    color: step.done ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                />
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs"
                  style={{
                    color: step.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: step.done ? 'line-through' : undefined,
                  }}
                >
                  {step.label}
                </div>
                {!step.done && (
                  <div
                    className="text-caption mt-0.5 flex items-center gap-1"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <ArrowRight className="w-3 h-3" />
                    {step.hint}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

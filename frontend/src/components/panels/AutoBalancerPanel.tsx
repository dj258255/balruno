'use client';

/**
 * AI Auto-Balancer 패널 — 두 유닛 + 목표 승률 입력 → 추천 파라미터 출력.
 *
 * Bisection 알고리즘으로 단일 파라미터(HP/ATK/DEF/Speed) 의 곱셈 인자를 탐색.
 * SimulationPanel 과는 별개의 입력 폼(독립 사용 가능). 향후 셀 매핑 연동 가능.
 */

import { useState } from 'react';
import { Wand2, Loader2, AlertTriangle } from 'lucide-react';
import { autoBalance, type AutoBalanceResult, type BalanceParam, type BalanceTarget } from '@/lib/autoBalancer';
import type { UnitStats } from '@/lib/simulation/types';
import ProgressBar from '@/components/ui/ProgressBar';
import PanelShell from '@/components/ui/PanelShell';
import ToolPanelHint from '@/components/onboarding/ToolPanelHint';

interface Props {
  onClose: () => void;
}

const DEFAULT_UNIT1: UnitStats = {
  id: 'unit1',
  name: 'Hero',
  hp: 1000, maxHp: 1000, atk: 100, def: 20, speed: 1,
  critRate: 0.15, critDamage: 1.5, accuracy: 1, evasion: 0,
};
const DEFAULT_UNIT2: UnitStats = {
  id: 'unit2',
  name: 'Boss',
  hp: 2000, maxHp: 2000, atk: 80, def: 30, speed: 0.8,
  critRate: 0.1, critDamage: 1.5, accuracy: 1, evasion: 0,
};

const PARAM_LABELS: Record<BalanceParam, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', speed: 'Speed',
};

export default function AutoBalancerPanel({ onClose }: Props) {
  const [unit1, setUnit1] = useState<UnitStats>(DEFAULT_UNIT1);
  const [unit2, setUnit2] = useState<UnitStats>(DEFAULT_UNIT2);
  const [target, setTarget] = useState<BalanceTarget>('unit1');
  const [param, setParam] = useState<BalanceParam>('atk');
  const [targetWinRate, setTargetWinRate] = useState(0.5);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ step: 0, total: 0, factor: 1, winRate: 0 });
  const [result, setResult] = useState<AutoBalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateStat = (which: 'unit1' | 'unit2', field: keyof UnitStats, value: number) => {
    const setter = which === 'unit1' ? setUnit1 : setUnit2;
    setter((prev) => {
      const next = { ...prev, [field]: value };
      // hp 변경 시 maxHp 도 동기화
      if (field === 'hp') next.maxHp = value;
      return next;
    });
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await autoBalance({
        unit1, unit2,
        target, param,
        targetWinRate,
        probeRuns: 500,
        verifyRuns: 2000,
        onProgress: (step, total, factor, winRate) => {
          setProgress({ step, total, factor, winRate });
        },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const applySuggestion = () => {
    if (!result) return;
    const setter = target === 'unit1' ? setUnit1 : setUnit2;
    setter((prev) => {
      const next = { ...prev };
      switch (param) {
        case 'hp':
          next.hp = result.suggestedValue;
          next.maxHp = result.suggestedValue;
          break;
        case 'atk': next.atk = result.suggestedValue; break;
        case 'def': next.def = result.suggestedValue; break;
        case 'speed': next.speed = result.suggestedValue; break;
      }
      return next;
    });
    setResult(null);
  };

  return (
    <PanelShell
      title="AI Auto-Balancer"
      subtitle="목표 승률에 맞춰 스탯 자동 추천"
      icon={Wand2}
      onClose={onClose}
    >
      <div className="space-y-4">
        <ToolPanelHint toolId="autoBalancer" title="AI Auto-Balancer — 목표 승률 자동 매칭" accentColor="#f43f5e">
          <p>두 유닛 + 목표 승률 (예: <strong>55%</strong>) 입력 → 한 파라미터 (HP/공격력/방어력 중 선택) 의 추천값을 시뮬로 자동 찾음.</p>
          <p>"이 캐릭터가 너무 셈, 공격력 얼마면 50:50 될까?" 같은 질문에 1-2초 안에 답.</p>
        </ToolPanelHint>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          두 유닛 스탯과 목표 승률을 입력하면, bisection 시뮬로 한 파라미터의 추천값을 찾습니다.
        </p>

        {/* 유닛 입력 */}
        <div className="grid grid-cols-2 gap-3">
          <UnitForm label="Unit 1 (아군)" unit={unit1} onChange={(f, v) => updateStat('unit1', f, v)} />
          <UnitForm label="Unit 2 (적)" unit={unit2} onChange={(f, v) => updateStat('unit2', f, v)} />
        </div>

        {/* 조정 설정 */}
        <div className="space-y-2 p-3 rounded border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>조정 설정</div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-20" style={{ color: 'var(--text-secondary)' }}>대상 유닛</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as BalanceTarget)}
              className="flex-1 px-2 py-1 text-xs rounded border bg-transparent"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <option value="unit1">Unit 1 ({unit1.name})</option>
              <option value="unit2">Unit 2 ({unit2.name})</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-20" style={{ color: 'var(--text-secondary)' }}>조정 스탯</label>
            <select
              value={param}
              onChange={(e) => setParam(e.target.value as BalanceParam)}
              className="flex-1 px-2 py-1 text-xs rounded border bg-transparent"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              {(Object.keys(PARAM_LABELS) as BalanceParam[]).map((p) => (
                <option key={p} value={p}>{PARAM_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-20" style={{ color: 'var(--text-secondary)' }}>목표 승률</label>
            <input
              type="range"
              min="0.05" max="0.95" step="0.05"
              value={targetWinRate}
              onChange={(e) => setTargetWinRate(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs font-mono w-10 text-right" style={{ color: 'var(--text-primary)' }}>
              {(targetWinRate * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            ※ 승률은 Unit 1 기준입니다.
          </p>
        </div>

        <button
          onClick={run}
          disabled={running}
          className="w-full px-3 py-2 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            background: running ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: running ? 'var(--text-secondary)' : 'white',
          }}
        >
          {running ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              탐색 중...
            </>
          ) : (
            <>
              <Wand2 size={14} />
              밸런스 자동 추천 실행
            </>
          )}
        </button>

        {running && progress.total > 0 && (
          <ProgressBar
            value={progress.step / progress.total}
            label={`단계 ${progress.step}/${progress.total}`}
            detail={`×${progress.factor.toFixed(2)} → ${(progress.winRate * 100).toFixed(1)}%`}
          />
        )}

        {error && (
          <div className="p-2 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            오류: {error}
          </div>
        )}

        {result && (
          <div className="space-y-2 p-3 rounded border-2" style={{
            borderColor: result.success ? '#10b981' : '#f59e0b',
            background: 'var(--bg-secondary)',
          }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: result.success ? '#10b981' : '#f59e0b' }}>
                {result.success ? '추천 완료' : '부분 성공'}
              </span>
            </div>

            <div className="text-xs space-y-1" style={{ color: 'var(--text-primary)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>현재 값</span>
                <span className="font-mono">{result.originalValue}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>추천 값</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>{result.suggestedValue}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>인자 (×)</span>
                <span className="font-mono">×{result.factor.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>달성 승률</span>
                <span className="font-mono">{(result.finalWinRate * 100).toFixed(1)}% (목표 {(result.targetWinRate * 100).toFixed(0)}%)</span>
              </div>
            </div>

            <p className="text-caption whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
              {result.explanation}
            </p>

            {result.warnings && result.warnings.length > 0 && (
              <div className="space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1 text-caption" style={{ color: '#f59e0b' }}>
                    <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={applySuggestion}
              className="w-full px-2 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              추천값 적용 (입력 폼 업데이트)
            </button>

            {/* trace */}
            <details className="text-caption">
              <summary className="cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                탐색 경로 ({result.trace.length} 단계)
              </summary>
              <div className="mt-1 space-y-0.5 font-mono">
                {result.trace.map((t, i) => (
                  <div key={i} className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>×{t.factor.toFixed(3)}</span>
                    <span>{(t.winRate * 100).toFixed(1)}%</span>
                    <span>{t.runs} runs</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function UnitForm({
  label, unit, onChange,
}: {
  label: string;
  unit: UnitStats;
  onChange: (field: keyof UnitStats, value: number) => void;
}) {
  return (
    <div className="space-y-1.5 p-2 rounded border" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="text-caption font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
      {([
        ['hp', 'HP'],
        ['atk', 'ATK'],
        ['def', 'DEF'],
        ['speed', 'SPD'],
        ['critRate', 'CR%'],
      ] as const).map(([key, lbl]) => (
        <div key={key} className="flex items-center gap-1.5">
          <label className="text-caption w-8" style={{ color: 'var(--text-secondary)' }}>{lbl}</label>
          <input
            type="number"
            value={unit[key as keyof UnitStats] as number ?? 0}
            onChange={(e) => onChange(key as keyof UnitStats, parseFloat(e.target.value) || 0)}
            step={key === 'speed' || key === 'critRate' ? 0.05 : 1}
            className="flex-1 min-w-0 px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </div>
      ))}
    </div>
  );
}

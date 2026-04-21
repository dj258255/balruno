'use client';

/**
 * RTS Build Order 시뮬 패널 — SC2/AoE4 경제·병력 타이밍 분석.
 */

import { useState, useMemo } from 'react';
import { Factory, Plus, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PanelShell from '@/components/ui/PanelShell';
import {
  simulateBuildOrder,
  SC2_TERRAN_MARINE_RUSH,
  AOE4_FEUDAL_RUSH,
  type BuildStep,
  type ActionType,
} from '@/lib/rtsBuildOrder';

interface Props {
  onClose: () => void;
}

const ACTION_COLOR: Record<ActionType, string> = {
  'build-worker':     '#10b981',
  'build-supply':     '#f59e0b',
  'build-production': '#3b82f6',
  'build-tech':       '#8b5cf6',
  'build-expansion':  '#ec4899',
  'train-unit':       '#ef4444',
  'train-worker-alt': '#22c55e',
};

const ACTION_LABEL: Record<ActionType, string> = {
  'build-worker':     '일꾼',
  'build-supply':     '서플라이',
  'build-production': '생산 건물',
  'build-tech':       '테크',
  'build-expansion':  '확장',
  'train-unit':       '유닛',
  'train-worker-alt': '확장 일꾼',
};

export default function RtsBuildOrderPanel({ onClose }: Props) {
  const [steps, setSteps] = useState<BuildStep[]>(SC2_TERRAN_MARINE_RUSH);
  const [duration, setDuration] = useState(300);

  const result = useMemo(() => simulateBuildOrder({ steps, durationSec: duration }), [steps, duration]);

  const chartData = result.samples.map((s) => ({
    sec: s.timeSec,
    minerals: s.minerals,
    gas: s.gas,
    workers: s.workers,
    supply: `${s.supplyUsed}/${s.supplyCap}`,
    income: s.mineralIncomePerMin,
    army: s.armyValue,
  }));

  const addStep = () => {
    const lastT = steps[steps.length - 1]?.timeSec ?? 0;
    setSteps((prev) => [...prev, {
      id: `s-${Date.now()}`,
      timeSec: lastT + 20,
      action: 'train-unit',
      label: '새 유닛',
      mineralCost: 50,
      supplyUsed: 1,
      buildDurationSec: 18,
    }]);
  };
  const updateStep = <K extends keyof BuildStep>(idx: number, key: K, value: BuildStep[K]) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx));

  const loadPreset = (preset: BuildStep[]) => setSteps([...preset]);

  return (
    <PanelShell
      title="RTS Build Order"
      subtitle="SC2/AoE4 경제·병력 타이밍"
      icon={Factory}
      iconColor="#f59e0b"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 프리셋 + 시간 */}
      <div className="p-3 rounded-lg flex items-center gap-2 flex-wrap" style={{ background: 'var(--bg-tertiary)' }}>
        <button onClick={() => loadPreset(SC2_TERRAN_MARINE_RUSH)} className="btn-primary text-caption">
          SC2 Marine Rush
        </button>
        <button onClick={() => loadPreset(AOE4_FEUDAL_RUSH)} className="btn-primary text-caption">
          AoE4 Feudal Rush
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-label" style={{ color: 'var(--text-secondary)' }}>
            <Clock className="w-3 h-3 inline" /> 시뮬 시간
          </span>
          <input
            type="range" min={60} max={900} step={30}
            value={duration} onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-32" style={{ accentColor: 'var(--accent)' }}
          />
          <span className="text-label font-semibold tabular-nums w-16 text-right" style={{ color: 'var(--text-primary)' }}>
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="최종 일꾼" value={result.finalWorkers.toString()} color="#10b981" />
        <Stat label="분당 수입" value={`${Math.round(result.finalIncomePerMin)}/m`} color="#3b82f6" />
        <Stat label="병력 가치" value={result.finalArmyValue.toLocaleString()} color="#ef4444" />
        <Stat
          label="유휴 자원"
          value={`${Math.round(result.idleResourceRatio * 100)}%`}
          sub={result.idleResourceRatio < 0.2 ? '효율적' : result.idleResourceRatio < 0.4 ? '보통' : '낭비 많음'}
          color={result.idleResourceRatio < 0.2 ? '#10b981' : result.idleResourceRatio < 0.4 ? '#f59e0b' : '#ef4444'}
        />
      </div>

      {/* 실패 경고 */}
      {result.failures.length > 0 && (
        <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#ef444420', borderLeft: '3px solid #ef4444' }}>
          <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
          <div className="flex-1 text-caption" style={{ color: 'var(--text-primary)' }}>
            <span className="font-semibold" style={{ color: '#ef4444' }}>{result.failures.length}개 스텝 실패</span>
            {' — '}
            {result.failures.slice(0, 3).map((f) => `${steps.find((s) => s.id === f.stepId)?.label ?? f.stepId} (${f.reason})`).join(', ')}
            {result.failures.length > 3 && ` 외 ${result.failures.length - 3}개`}
          </div>
        </div>
      )}

      {/* 자원 곡선 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          자원 + 일꾼 + 병력 가치
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="sec" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="l" type="monotone" dataKey="minerals" stroke="#3b82f6" strokeWidth={2} name="Minerals" dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="gas" stroke="#22c55e" strokeWidth={2} name="Gas" dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="army" stroke="#ef4444" strokeWidth={2} name="Army Value" dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="workers" stroke="#f59e0b" strokeWidth={2} name="Workers" dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Build order editor */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            Build Order ({steps.length} step)
          </span>
          <button onClick={addStep} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 추가
          </button>
        </div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {steps.map((s, idx) => {
            const color = ACTION_COLOR[s.action];
            const failed = result.failures.some((f) => f.stepId === s.id);
            return (
              <div
                key={s.id}
                className="flex items-center gap-1.5 p-1.5 rounded"
                style={{
                  background: failed ? '#ef444420' : 'var(--bg-primary)',
                  borderLeft: failed ? '3px solid #ef4444' : `3px solid ${color}`,
                }}
              >
                <span className="text-caption tabular-nums font-mono w-12" style={{ color: 'var(--text-tertiary)' }}>
                  {Math.floor(s.timeSec / 60)}:{(s.timeSec % 60).toString().padStart(2, '0')}
                </span>
                <input
                  type="number"
                  value={s.timeSec}
                  onChange={(e) => updateStep(idx, 'timeSec', parseInt(e.target.value) || 0)}
                  className="input-compact hide-spinner w-14"
                  title="초"
                />
                <select
                  value={s.action}
                  onChange={(e) => updateStep(idx, 'action', e.target.value as ActionType)}
                  className="input-compact"
                  style={{ width: 100, color }}
                >
                  {Object.entries(ACTION_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  value={s.label}
                  onChange={(e) => updateStep(idx, 'label', e.target.value)}
                  className="input-compact flex-1 min-w-0"
                  placeholder="이름"
                />
                <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>min</label>
                <input
                  type="number"
                  value={s.mineralCost}
                  onChange={(e) => updateStep(idx, 'mineralCost', parseInt(e.target.value) || 0)}
                  className="input-compact hide-spinner w-16"
                />
                <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>sec</label>
                <input
                  type="number"
                  value={s.buildDurationSec}
                  onChange={(e) => updateStep(idx, 'buildDurationSec', parseInt(e.target.value) || 0)}
                  className="input-compact hide-spinner w-14"
                />
                <button onClick={() => removeStep(idx)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        SC2 기준 (SCV 50m/12s · mineral rate 45/min · supply 15 기본). 일꾼 saturation 32명까지.
      </p>
    </PanelShell>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-heading font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}

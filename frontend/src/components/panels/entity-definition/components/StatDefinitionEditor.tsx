'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { CurveType } from '@/types';
import CustomSelect, { type SelectOption } from '@/components/ui/CustomSelect';

export interface StatDefinition {
  name: string;           // 스탯명 (예: HP, ATK)
  sourceColumn: string;   // 시트에서 값을 가져올 컬럼명
  curveType: CurveType;   // 성장 곡선
  growthRate: number;     // 성장률
  exportName?: string;    // Export 필드명 (비어있으면 name 사용)
}

interface StatDefinitionEditorProps {
  stats: StatDefinition[];
  availableColumns: string[];  // 시트의 컬럼 목록
  onChange: (stats: StatDefinition[]) => void;
}

const CURVE_OPTIONS: SelectOption[] = [
  { value: 'linear', label: '선형', description: '일정한 증가' },
  { value: 'exponential', label: '지수', description: '점점 빠르게' },
  { value: 'logarithmic', label: '로그', description: '점점 느리게' },
  { value: 'quadratic', label: '2차', description: '가속 증가' },
  { value: 'scurve', label: 'S-커브', description: '초반↓ 중반↑ 후반↓' },
];

const DEFAULT_GROWTH_RATES: Record<CurveType, number> = {
  linear: 10,
  exponential: 1.08,
  logarithmic: 50,
  quadratic: 0.5,
  scurve: 0.1,
};

export default function StatDefinitionEditor({
  stats,
  availableColumns,
  onChange,
}: StatDefinitionEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newStatName, setNewStatName] = useState('');

  const addStat = () => {
    if (!newStatName.trim()) return;

    const name = newStatName.trim().toUpperCase();
    if (stats.some(s => s.name === name)) return;

    onChange([
      ...stats,
      {
        name,
        sourceColumn: '',
        curveType: 'exponential',
        growthRate: 1.08,
      },
    ]);
    setNewStatName('');
    setIsAdding(false);
  };

  const removeStat = (index: number) => {
    onChange(stats.filter((_, i) => i !== index));
  };

  const updateStat = (index: number, updates: Partial<StatDefinition>) => {
    onChange(stats.map((stat, i) => {
      if (i === index) {
        const updated = { ...stat, ...updates };
        // 곡선 타입 변경 시 기본 성장률로 리셋
        if (updates.curveType && updates.curveType !== stat.curveType) {
          updated.growthRate = DEFAULT_GROWTH_RATES[updates.curveType];
        }
        return updated;
      }
      return stat;
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          스탯 정의
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
          style={{
            background: 'var(--primary-purple-light)',
            color: 'var(--primary-purple)',
          }}
        >
          <Plus className="w-3 h-3" />
          스탯 추가
        </button>
      </div>

      {/* 스탯 추가 입력 */}
      {isAdding && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          <input
            type="text"
            value={newStatName}
            onChange={(e) => setNewStatName(e.target.value.toUpperCase())}
            placeholder="스탯명 (예: SPD, CRIT)"
            className="flex-1 input-base"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addStat();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            autoFocus
          />
          <button
            onClick={addStat}
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: 'var(--primary-purple)', color: 'white' }}
          >
            추가
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="p-1.5 rounded"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 스탯 목록 */}
      {stats.length === 0 ? (
        <div
          className="p-4 rounded-lg text-center text-sm"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
        >
          정의된 스탯이 없습니다. 스탯을 추가해주세요.
        </div>
      ) : (
        <div className="space-y-2">
          {stats.map((stat, index) => (
            <div
              key={stat.name}
              className="p-3 rounded-lg"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {stat.name}
                </span>
                <button
                  onClick={() => removeStat(index)}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {/* 소스 컬럼 */}
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    소스 컬럼
                  </label>
                  <CustomSelect
                    value={stat.sourceColumn}
                    onChange={(value) => updateStat(index, { sourceColumn: value })}
                    options={[
                      { value: '', label: '선택...' },
                      ...availableColumns.map((col) => ({ value: col, label: col })),
                    ]}
                    placeholder="선택..."
                    size="sm"
                    color="#5a9cf5"
                  />
                </div>

                {/* 곡선 타입 */}
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    성장 곡선
                  </label>
                  <CustomSelect
                    value={stat.curveType}
                    onChange={(value) => updateStat(index, { curveType: value as CurveType })}
                    options={CURVE_OPTIONS}
                    size="sm"
                    color="#22c55e"
                  />
                </div>

                {/* 성장률 */}
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    성장률
                  </label>
                  <input
                    type="number"
                    value={stat.growthRate}
                    onChange={(e) => updateStat(index, { growthRate: parseFloat(e.target.value) || 1 })}
                    step={stat.curveType === 'exponential' ? 0.01 : 1}
                    className="w-full input-compact hide-spinner"
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {/* Export 필드명 */}
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    Export명
                  </label>
                  <input
                    type="text"
                    value={stat.exportName || ''}
                    onChange={(e) => updateStat(index, { exportName: e.target.value })}
                    placeholder={stat.sourceColumn || stat.name}
                    className="w-full input-compact"
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 안내 */}
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        소스 컬럼은 시트에서 기본값(레벨 1)을 가져올 컬럼입니다. Export명이 비어있으면 스탯명이 사용됩니다.
      </p>
    </div>
  );
}

'use client';

/**
 * FilterBuilder — SavedView.filterGroup 편집 UI. Linear Triage / Jira JQL 대응.
 *
 * 동작:
 *  - AND/OR combinator 토글
 *  - 조건 리스트 (column · operator · value) 추가/제거/수정
 *  - onChange(filterGroup) 로 부모에 전달
 *
 * 현재 간단형: 단일 그룹, 중첩 그룹은 미구현 (UI 복잡도 ↑ 대비 이득 ↓).
 */

import { Plus, X, Filter } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import type { Column, FilterGroup, FilterCondition, FilterOperator } from '@/types';
import { operatorNeedsValue, OPERATOR_LABELS, createEmptyFilterGroup } from '@/lib/filterEval';

interface Props {
  columns: Column[];
  value: FilterGroup | undefined;
  onChange: (next: FilterGroup | undefined) => void;
}

/** 컬럼 타입별로 허용 연산자 좁힘 */
function operatorsFor(column: Column | undefined): FilterOperator[] {
  if (!column) return ['equals'];
  const t = column.type;
  if (t === 'person') {
    return ['is-me', 'equals', 'not-equals', 'includes', 'not-includes', 'is-empty', 'is-not-empty'];
  }
  if (t === 'multiSelect' || t === 'link' || t === 'task-link') {
    return ['includes', 'not-includes', 'is-empty', 'is-not-empty'];
  }
  if (t === 'select') {
    return ['equals', 'not-equals', 'is-empty', 'is-not-empty'];
  }
  if (t === 'checkbox') {
    return ['equals', 'not-equals'];
  }
  if (t === 'rating' || t === 'currency') {
    return ['equals', 'not-equals', 'greater-than', 'less-than', 'is-empty', 'is-not-empty'];
  }
  if (t === 'date') {
    return ['equals', 'greater-than', 'less-than', 'is-empty', 'is-not-empty'];
  }
  // general / formula / lookup / rollup 등 자유 텍스트
  return ['contains', 'not-contains', 'equals', 'not-equals', 'is-empty', 'is-not-empty'];
}

function genConditionId(): string {
  return `fc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function FilterBuilder({ columns, value, onChange }: Props) {
  const group = value ?? createEmptyFilterGroup();

  const addCondition = () => {
    const firstCol = columns[0];
    if (!firstCol) return;
    const ops = operatorsFor(firstCol);
    const next: FilterCondition = {
      id: genConditionId(),
      columnId: firstCol.id,
      operator: ops[0] ?? 'equals',
      value: '',
    };
    // group.conditions stale 방지 — value (sheet.filterGroup) 가 undefined 인 경우 빈 그룹 사용
    const base = value ?? createEmptyFilterGroup();
    onChange({ ...base, conditions: [...base.conditions, next] });
  };

  const updateCondition = (idx: number, patch: Partial<FilterCondition>) => {
    const next = group.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...group, conditions: next });
  };

  const removeCondition = (idx: number) => {
    const next = group.conditions.filter((_, i) => i !== idx);
    if (next.length === 0) {
      onChange(undefined);
    } else {
      onChange({ ...group, conditions: next });
    }
  };

  const clearAll = () => onChange(undefined);

  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            필터
          </span>
          {group.conditions.length > 1 && (
            <div className="flex gap-0.5 p-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>
              {(['and', 'or'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...group, combinator: c })}
                  className="px-2 py-0.5 text-caption rounded transition-colors"
                  style={{
                    background: group.combinator === c ? 'var(--accent)' : 'transparent',
                    color: group.combinator === c ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {c === 'and' ? 'AND' : 'OR'}
                </button>
              ))}
            </div>
          )}
        </div>
        {group.conditions.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-caption opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            초기화
          </button>
        )}
      </div>

      {group.conditions.length === 0 && (
        <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          조건 추가 버튼으로 필터를 시작하세요.
        </p>
      )}

      {group.conditions.map((cond, idx) => {
        const col = columns.find((c) => c.id === cond.columnId);
        const opts = operatorsFor(col);
        const needsValue = operatorNeedsValue(cond.operator);
        return (
          <div key={cond.id} className="flex items-center gap-1.5 flex-wrap">
            {idx > 0 && (
              <span className="text-caption font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {group.combinator === 'or' ? 'OR' : 'AND'}
              </span>
            )}
            <div className="w-28">
              <CustomSelect
                value={cond.columnId}
                onChange={(v) => {
                  const newCol = columns.find((c) => c.id === v);
                  const newOps = operatorsFor(newCol);
                  updateCondition(idx, {
                    columnId: v,
                    operator: newOps.includes(cond.operator) ? cond.operator : newOps[0],
                  });
                }}
                options={columns.map((c) => ({ value: c.id, label: c.name }))}
                size="sm"
              />
            </div>
            <div className="w-28">
              <CustomSelect
                value={cond.operator}
                onChange={(v) => updateCondition(idx, { operator: v as FilterOperator })}
                options={opts.map((o) => ({ value: o, label: OPERATOR_LABELS[o] }))}
                size="sm"
              />
            </div>
            {needsValue && (
              <input
                type="text"
                value={cond.value ?? ''}
                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                placeholder="값"
                className="flex-1 min-w-[80px] max-w-[180px] px-2 py-1 text-xs rounded"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            )}
            <button
              type="button"
              onClick={() => removeCondition(idx)}
              className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
              aria-label="조건 제거"
            >
              <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addCondition}
        disabled={columns.length === 0}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: 'var(--accent)' }}
        title={columns.length === 0 ? '시트에 컬럼이 없어 필터를 만들 수 없어요 — 컬럼을 먼저 추가하세요' : '필터 조건 추가'}
      >
        <Plus className="w-3 h-3" />
        조건 추가
      </button>
    </div>
  );
}

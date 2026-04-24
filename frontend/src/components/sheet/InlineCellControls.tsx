'use client';

/**
 * 셀 display 모드에서 직접 조작하는 인라인 컨트롤.
 *
 * - checkbox: 한 번 클릭으로 토글
 * - rating: 별 클릭으로 1~max 값 설정 (max 별 한 번 더 누르면 0)
 *
 * 더블클릭으로 편집 모드 진입 X — 컨트롤 자체가 에디터 역할.
 */

import { Check, Star, Circle, User } from 'lucide-react';
import type { CellValue, Column, Sheet } from '@/types';

/**
 * person / assignee 컬럼 인라인 렌더. 값은 콤마 split — 한 명 또는 여러 명.
 * 아바타 (이니셜) + 이름. 여러 명이면 아바타 겹침 + 이름 첫 명만 표시.
 *
 * 편집은 기존 셀 더블클릭 경로 유지 (아바타는 표시만).
 */
export function InlinePerson({
  value,
}: {
  value: CellValue;
}) {
  const raw = typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
  if (!raw) {
    return (
      <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <User className="w-3 h-3" />
        <span className="opacity-60">미지정</span>
      </span>
    );
  }
  const names = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const visible = names.slice(0, 3);
  const extra = names.length - visible.length;

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="flex -space-x-1 shrink-0">
        {visible.map((name) => (
          <span
            key={name}
            className="w-5 h-5 rounded-full flex items-center justify-center text-caption font-medium ring-2"
            style={{
              background: personColor(name),
              color: 'white',
              boxShadow: '0 0 0 2px var(--bg-primary)',
            }}
            title={name}
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </span>
      <span className="truncate text-xs" style={{ color: 'var(--text-primary)' }}>
        {names[0]}
        {extra > 0 && (
          <span className="opacity-60"> +{extra}</span>
        )}
      </span>
    </span>
  );
}

function personColor(name: string): string {
  const palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function InlineCheckbox({
  value,
  onChange,
  disabled,
}: {
  value: CellValue;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  // CellValue 는 string|number|null. boolean 직접 비교는 타입상 불가하므로 unknown 캐스트.
  const v = value as unknown;
  const checked = v === true || v === 'true' || v === 1 || v === '1';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      className="w-4 h-4 rounded flex items-center justify-center transition-colors"
      style={{
        background: checked ? 'var(--accent)' : 'transparent',
        border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-primary)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
      aria-pressed={checked}
      aria-label={checked ? '체크 해제' : '체크'}
    >
      {checked && <Check size={11} color="white" strokeWidth={3} />}
    </button>
  );
}

/**
 * task-link 셀 인라인 렌더.
 * 값 = 참조 task sheet 의 row id (또는 CSV). 표시: [● 상태] 이름 · @담당자
 */
export function InlineTaskLink({
  value,
  column,
  taskSheet,
  onOpen,
}: {
  value: CellValue;
  column: Column;
  taskSheet?: Sheet;
  onOpen?: (rowId: string) => void;
}) {
  if (!taskSheet || !value) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        (연결 안 됨)
      </span>
    );
  }

  const rowIds = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rowIds.length === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        —
      </span>
    );
  }

  const statusColId = column.taskStatusColumnId;
  const assigneeColId = column.taskAssigneeColumnId;

  // 상태 컬럼의 selectOptions 에서 color 룩업
  const statusOptions = statusColId
    ? taskSheet.columns.find((c) => c.id === statusColId)?.selectOptions ?? []
    : [];

  // 이름 컬럼 — 첫 번째 일반 컬럼 사용
  const nameColId =
    taskSheet.columns.find((c) => c.type === 'general' && !c.id.includes('id'))?.id
    ?? taskSheet.columns[0]?.id;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {rowIds.map((rid) => {
        const row = taskSheet.rows.find((r) => r.id === rid);
        if (!row) {
          return (
            <span
              key={rid}
              className="text-caption px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
            >
              {rid.slice(0, 6)}?
            </span>
          );
        }
        const name = nameColId ? String(row.cells[nameColId] ?? rid) : rid;
        const statusId = statusColId ? String(row.cells[statusColId] ?? '') : '';
        const statusOpt = statusOptions.find((o) => o.id === statusId);
        const assignee = assigneeColId ? String(row.cells[assigneeColId] ?? '') : '';

        return (
          <button
            key={rid}
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(rid);
            }}
            className="inline-flex items-center gap-1 text-caption px-1.5 py-0.5 rounded border transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              borderColor: statusOpt?.color ?? 'var(--border-primary)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              maxWidth: 180,
            }}
            title={`${name}${statusOpt ? ` · ${statusOpt.label}` : ''}${assignee ? ` · @${assignee}` : ''}`}
          >
            {statusOpt && (
              <Circle
                size={8}
                fill={statusOpt.color ?? '#94a3b8'}
                stroke="none"
                className="shrink-0"
              />
            )}
            <span className="truncate">{name}</span>
            {assignee && (
              <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                @{assignee.slice(0, 8)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function InlineRating({
  value,
  max = 5,
  onChange,
  disabled,
}: {
  value: CellValue;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const current = typeof value === 'number'
    ? Math.max(0, Math.min(max, value))
    : Math.max(0, Math.min(max, parseInt(String(value || 0), 10) || 0));

  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="별점">
      {Array.from({ length: max }).map((_, i) => {
        const idx = i + 1;
        const active = idx <= current;
        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              // 같은 별 클릭 시 그 값 또는 0 (max 일 때는 0 으로 reset)
              const next = idx === current ? (idx === max ? 0 : idx) : idx;
              onChange(next);
            }}
            disabled={disabled}
            className="p-0 transition-transform hover:scale-110"
            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
            aria-checked={active}
            aria-label={`${idx}점`}
            role="radio"
          >
            <Star
              size={14}
              fill={active ? '#f59e0b' : 'transparent'}
              stroke={active ? '#f59e0b' : 'var(--text-secondary)'}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}

'use client';

/**
 * PM Badge Strip — SheetKind='pm' (또는 자동 감지) 시트 상단에 고정되는 배지 띠.
 *
 * 표시 요소:
 *  - 타입 라벨 (Sprint / Bug / Playtest / Roadmap / 태스크) — `PM_TYPE_LABELS`
 *  - 상태별 카운트 (status select 옵션 기준)
 *  - 우선순위별 카운트 (priority/우선순위 select 컬럼 있을 때)
 *  - 담당자 아바타 (최대 5명 + 더 있으면 "+N")
 *
 * 일반 / 밸런싱 시트에서는 null 반환 — 원점 흐리지 않음.
 *
 * 비고: 이건 *시각적 요약* 만. 필터·그룹핑 같은 인터랙션은 각 뷰 (Kanban 등)
 * 가 담당. 밸런싱 원점을 지키되 PM 시트 한정으로 "Linear 느낌" 노출.
 */

import { useMemo } from 'react';
import { Users, CircleDot, Flag, X } from 'lucide-react';
import type { Sheet, Column } from '@/types';
import { detectPmSheet, PM_TYPE_LABELS } from '@/lib/pmSheetDetection';
import { useSheetUIStore } from '@/stores/sheetUIStore';

interface Props {
  sheet: Sheet;
}

/** 우선순위 컬럼 감지 — priority / 우선순위 이름의 select 컬럼 */
function findPriorityColumn(columns: Column[]): Column | undefined {
  const needles = ['priority', '우선순위', 'prio'];
  return columns.find(
    (c) =>
      c.type === 'select' &&
      needles.some((n) => c.name.toLowerCase().trim().includes(n)),
  );
}

export function PmBadgeStrip({ sheet }: Props) {
  // 모든 훅은 최상단 — 조건부 반환 전에. Rules of Hooks 준수.
  const detection = useMemo(() => detectPmSheet(sheet), [sheet]);
  const quickFilter = useSheetUIStore((s) => s.quickFilter);
  const setFilterAssignee = useSheetUIStore((s) => s.setQuickFilterAssignee);
  const setFilterPriority = useSheetUIStore((s) => s.setQuickFilterPriority);
  const clearFilter = useSheetUIStore((s) => s.clearQuickFilter);

  const isPm = sheet.kind === 'pm' || detection.type !== null;
  const activeFilter = quickFilter && quickFilter.sheetId === sheet.id ? quickFilter : null;

  const statusCol = detection.statusColumnId
    ? sheet.columns.find((c) => c.id === detection.statusColumnId)
    : undefined;
  const assigneeCol = detection.assigneeColumnId
    ? sheet.columns.find((c) => c.id === detection.assigneeColumnId)
    : undefined;

  const priorityCol = useMemo(
    () => (isPm ? findPriorityColumn(sheet.columns) : undefined),
    [sheet.columns, isPm],
  );

  // 상태 집계 — cell 값은 option.id 또는 label 둘 다 올 수 있음 (구버전 호환).
  // option 의 id 와 label 로 동시 매칭해서 항상 display label 로 표시.
  const statusBuckets = useMemo(() => {
    if (!isPm || !statusCol) return null;
    const counts = new Map<string, number>();
    for (const row of sheet.rows) {
      const v = row.cells[statusCol.id];
      const key = v === null || v === undefined || v === '' ? '(미지정)' : String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const ordered: Array<{ label: string; count: number; color?: string }> = [];
    for (const opt of statusCol.selectOptions ?? []) {
      const byId = counts.get(opt.id) ?? 0;
      const byLabel = counts.get(opt.label) ?? 0;
      const total = byId + byLabel;
      if (total > 0) {
        ordered.push({ label: opt.label, count: total, color: opt.color });
        counts.delete(opt.id);
        counts.delete(opt.label);
      }
    }
    for (const [label, count] of counts) ordered.push({ label, count });
    return ordered;
  }, [isPm, statusCol, sheet.rows]);

  const priorityBuckets = useMemo(() => {
    if (!isPm || !priorityCol) return null;
    const counts = new Map<string, number>();
    for (const row of sheet.rows) {
      const v = row.cells[priorityCol.id];
      if (v === null || v === undefined || v === '') continue;
      counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
    }
    const ordered: Array<{ label: string; count: number; color?: string }> = [];
    for (const opt of priorityCol.selectOptions ?? []) {
      const byId = counts.get(opt.id) ?? 0;
      const byLabel = counts.get(opt.label) ?? 0;
      const total = byId + byLabel;
      if (total > 0) {
        ordered.push({ label: opt.label, count: total, color: opt.color });
        counts.delete(opt.id);
        counts.delete(opt.label);
      }
    }
    for (const [label, count] of counts) ordered.push({ label, count });
    return ordered;
  }, [isPm, priorityCol, sheet.rows]);

  const assignees = useMemo(() => {
    if (!isPm || !assigneeCol) return null;
    const set = new Set<string>();
    for (const row of sheet.rows) {
      const v = row.cells[assigneeCol.id];
      if (v === null || v === undefined || v === '') continue;
      for (const name of String(v).split(',').map((s) => s.trim()).filter(Boolean)) {
        set.add(name);
      }
    }
    return Array.from(set);
  }, [isPm, assigneeCol, sheet.rows]);

  // ↓ 모든 훅 호출 후 조건부 반환
  if (!isPm) return null;

  const pmType = detection.type ?? 'generic-pm';
  const hasAnyBadge = statusBuckets || priorityBuckets || assignees;
  if (!hasAnyBadge) {
    // PM 시트지만 집계 축이 없는 경우 — 타입 라벨만
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs flex-wrap"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
      >
        <TypeBadge label={PM_TYPE_LABELS[pmType]} />
        <span style={{ color: 'var(--text-tertiary)' }}>
          집계 가능한 컬럼 (Status / Assignee / Priority) 이 없습니다
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg text-xs flex-wrap"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <TypeBadge label={PM_TYPE_LABELS[pmType]} />

      {statusBuckets && statusBuckets.length > 0 && (
        <BadgeGroup icon={<CircleDot className="w-3 h-3" />} label={statusCol?.name ?? 'Status'}>
          {statusBuckets.map((b) => (
            <Badge key={b.label} label={b.label} count={b.count} color={b.color} />
          ))}
        </BadgeGroup>
      )}

      {priorityBuckets && priorityBuckets.length > 0 && (
        <BadgeGroup icon={<Flag className="w-3 h-3" />} label={priorityCol?.name ?? 'Priority'}>
          {priorityBuckets.map((b) => {
            const active = activeFilter?.priority === b.label;
            return (
              <Badge
                key={b.label}
                label={b.label}
                count={b.count}
                color={b.color}
                active={active}
                onClick={() => setFilterPriority(sheet.id, active ? null : b.label)}
              />
            );
          })}
        </BadgeGroup>
      )}

      {assignees && assignees.length > 0 && (
        <BadgeGroup icon={<Users className="w-3 h-3" />} label={assigneeCol?.name ?? 'Assignee'}>
          <AssigneeAvatars
            names={assignees}
            activeAssignee={activeFilter?.assignee}
            onToggle={(name) =>
              setFilterAssignee(sheet.id, activeFilter?.assignee === name ? null : name)
            }
          />
        </BadgeGroup>
      )}

      {activeFilter && (activeFilter.assignee || activeFilter.priority) && (
        <button
          type="button"
          onClick={clearFilter}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-caption transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}
          title="필터 해제"
        >
          <X className="w-3 h-3" />
          필터:
          {activeFilter.assignee && <span>@{activeFilter.assignee}</span>}
          {activeFilter.priority && <span>{activeFilter.priority}</span>}
        </button>
      )}
    </div>
  );
}

function TypeBadge({ label }: { label: string }) {
  return (
    <span
      className="text-overline px-1.5 py-0.5 rounded font-semibold"
      style={{ background: 'var(--accent)', color: 'white' }}
    >
      {label}
    </span>
  );
}

function BadgeGroup({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 opacity-70" style={{ color: 'var(--text-secondary)' }}>
        {icon}
        <span className="text-caption">{label}</span>
      </span>
      <div className="flex items-center gap-1 flex-wrap">{children}</div>
    </div>
  );
}

function Badge({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const baseStyle: React.CSSProperties = {
    background: active ? (color ?? 'var(--accent)') : color ? `${color}22` : 'var(--bg-tertiary)',
    color: active ? 'white' : color ?? 'var(--text-secondary)',
    border: `1px solid ${active ? (color ?? 'var(--accent)') : color ?? 'var(--border-primary)'}`,
    cursor: interactive ? 'pointer' : 'default',
  };
  const content = (
    <>
      {color && !active && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      )}
      <span>{label}</span>
      <span className="opacity-60">{count}</span>
    </>
  );
  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption transition-colors hover:brightness-110"
        style={baseStyle}
        title={`${label}: ${count}${active ? ' (필터 활성 — 클릭으로 해제)' : ' (클릭으로 필터)'}`}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption"
      style={baseStyle}
      title={`${label}: ${count}`}
    >
      {content}
    </span>
  );
}

function AssigneeAvatars({
  names,
  activeAssignee,
  onToggle,
}: {
  names: string[];
  activeAssignee?: string;
  onToggle?: (name: string) => void;
}) {
  const visible = names.slice(0, 5);
  const extra = names.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((name) => {
        const active = activeAssignee === name;
        const interactive = Boolean(onToggle);
        const style: React.CSSProperties = {
          background: colorFromName(name),
          color: 'white',
          boxShadow: `0 0 0 2px var(--bg-secondary)${active ? `, 0 0 0 4px ${colorFromName(name)}` : ''}`,
          transform: active ? 'scale(1.1)' : undefined,
          transition: 'transform 120ms',
          cursor: interactive ? 'pointer' : 'default',
        };
        const content = name.slice(0, 1).toUpperCase();
        if (interactive) {
          return (
            <button
              type="button"
              key={name}
              onClick={() => onToggle?.(name)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-caption font-medium hover:brightness-110"
              style={style}
              title={`${name}${active ? ' (필터 활성 — 클릭으로 해제)' : ' (클릭으로 필터)'}`}
            >
              {content}
            </button>
          );
        }
        return (
          <span
            key={name}
            className="w-5 h-5 rounded-full flex items-center justify-center text-caption font-medium"
            style={style}
            title={name}
          >
            {content}
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-caption font-medium"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            boxShadow: '0 0 0 2px var(--bg-secondary)',
          }}
          title={`+${extra}`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

// 이름 → 색 (간단 hash). lucide 색상 팔레트와 유사 톤.
function colorFromName(name: string): string {
  const palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

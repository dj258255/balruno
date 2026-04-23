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
import { Users, CircleDot, Flag } from 'lucide-react';
import type { Sheet, Column } from '@/types';
import { detectPmSheet, PM_TYPE_LABELS } from '@/lib/pmSheetDetection';

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
  // 명시 kind='pm' 이 최우선. 아니면 auto detect.
  const detection = useMemo(() => detectPmSheet(sheet), [sheet]);
  const isPm = sheet.kind === 'pm' || detection.type !== null;

  if (!isPm) return null;

  const pmType = detection.type ?? 'generic-pm';
  const statusCol = detection.statusColumnId
    ? sheet.columns.find((c) => c.id === detection.statusColumnId)
    : undefined;
  const assigneeCol = detection.assigneeColumnId
    ? sheet.columns.find((c) => c.id === detection.assigneeColumnId)
    : undefined;
  const priorityCol = useMemo(() => findPriorityColumn(sheet.columns), [sheet.columns]);

  // 상태 집계 — select option 기준. 빈 값은 "(미지정)" 으로
  const statusBuckets = useMemo(() => {
    if (!statusCol) return null;
    const counts = new Map<string, number>();
    for (const row of sheet.rows) {
      const v = row.cells[statusCol.id];
      const key = v === null || v === undefined || v === '' ? '(미지정)' : String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // select option 순서 존중
    const optionOrder = (statusCol.selectOptions ?? []).map((o) => o.label);
    const ordered: Array<{ label: string; count: number; color?: string }> = [];
    for (const opt of statusCol.selectOptions ?? []) {
      const c = counts.get(opt.label);
      if (c) {
        ordered.push({ label: opt.label, count: c, color: opt.color });
        counts.delete(opt.label);
      }
    }
    // 미지정 · 옵션 외
    for (const [label, count] of counts) {
      ordered.push({ label, count });
    }
    return ordered;
  }, [statusCol, sheet.rows]);

  // 우선순위 집계
  const priorityBuckets = useMemo(() => {
    if (!priorityCol) return null;
    const counts = new Map<string, number>();
    for (const row of sheet.rows) {
      const v = row.cells[priorityCol.id];
      if (v === null || v === undefined || v === '') continue;
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const ordered: Array<{ label: string; count: number; color?: string }> = [];
    for (const opt of priorityCol.selectOptions ?? []) {
      const c = counts.get(opt.label);
      if (c) {
        ordered.push({ label: opt.label, count: c, color: opt.color });
        counts.delete(opt.label);
      }
    }
    for (const [label, count] of counts) ordered.push({ label, count });
    return ordered;
  }, [priorityCol, sheet.rows]);

  // 담당자 — person 컬럼 또는 assignee select 컬럼. 값을 콤마 split 으로 여러 명 지원.
  const assignees = useMemo(() => {
    if (!assigneeCol) return null;
    const set = new Set<string>();
    for (const row of sheet.rows) {
      const v = row.cells[assigneeCol.id];
      if (v === null || v === undefined || v === '') continue;
      for (const name of String(v).split(',').map((s) => s.trim()).filter(Boolean)) {
        set.add(name);
      }
    }
    return Array.from(set);
  }, [assigneeCol, sheet.rows]);

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
          {priorityBuckets.map((b) => (
            <Badge key={b.label} label={b.label} count={b.count} color={b.color} />
          ))}
        </BadgeGroup>
      )}

      {assignees && assignees.length > 0 && (
        <BadgeGroup icon={<Users className="w-3 h-3" />} label={assigneeCol?.name ?? 'Assignee'}>
          <AssigneeAvatars names={assignees} />
        </BadgeGroup>
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

function Badge({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption"
      style={{
        background: color ? `${color}22` : 'var(--bg-tertiary)',
        color: color ?? 'var(--text-secondary)',
        border: `1px solid ${color ?? 'var(--border-primary)'}`,
      }}
      title={`${label}: ${count}`}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color }}
        />
      )}
      <span>{label}</span>
      <span className="opacity-60">{count}</span>
    </span>
  );
}

function AssigneeAvatars({ names }: { names: string[] }) {
  const visible = names.slice(0, 5);
  const extra = names.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((name) => (
        <span
          key={name}
          className="w-5 h-5 rounded-full flex items-center justify-center text-caption font-medium ring-2"
          style={{
            background: colorFromName(name),
            color: 'white',
            boxShadow: '0 0 0 2px var(--bg-secondary)',
          }}
          title={name}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      ))}
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

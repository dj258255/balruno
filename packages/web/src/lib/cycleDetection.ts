/**
 * Cycle / Sprint 1급 엔티티 감지 — Linear 의 Cycles · Jira 의 Sprints 대응.
 *
 * Cycles 시트 convention:
 *   - 시트 이름에 "Cycle" / "Sprint" / "사이클" / "스프린트" 포함
 *   - start / end (또는 한글) date 컬럼 각 1 개
 *   - 각 row = 1 cycle
 *
 * Issues 시트 에서 cycle 컬럼 (task-link → Cycles 시트) 으로 연결.
 *
 * 주요 함수:
 *  - findCyclesSheet(project): Cycles 시트 찾기 (여러 개면 가장 최근 업데이트)
 *  - detectCurrent(cyclesSheet): 오늘 날짜 기준 current / prev / next cycle
 *  - findIssuesForCycle(project, cycleRowId): 해당 cycle 에 연결된 이슈들
 *  - carryOverUnfinished(project, fromCycleId, toCycleId, statusDoneValues):
 *      from cycle 의 미완료 이슈들의 cycle 컬럼을 to cycle 로 이전
 */

import type { Project, Sheet, Column, Row } from '@/types';

export interface CyclesContext {
  sheet: Sheet;
  startCol: Column;
  endCol: Column;
  nameCol?: Column;
}

export interface DetectedCycles {
  current?: Row;
  previous?: Row;
  next?: Row;
  all: Row[];
}

function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 시트 이름이 Cycle/Sprint 패턴 매칭인지 */
function isCyclesSheetName(name: string): boolean {
  const n = name.toLowerCase().trim();
  return /\bcycles?\b|\bsprints?\b|사이클|스프린트/.test(n);
}

function matchCol(cols: Column[], ...keys: string[]): Column | undefined {
  const needles = keys.map((k) => k.toLowerCase());
  return cols.find((c) => {
    const cn = c.name.toLowerCase().trim();
    return needles.some((k) => cn === k || cn.includes(k));
  });
}

/** 프로젝트에서 Cycles 시트 찾기. 여러 개면 updatedAt 최신 우선 */
export function findCyclesSheet(project: Project): CyclesContext | null {
  const candidates = project.sheets.filter((s) => isCyclesSheetName(s.name));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.updatedAt - a.updatedAt);

  for (const sheet of candidates) {
    const startCol = matchCol(sheet.columns, 'start', 'begin', '시작');
    const endCol = matchCol(sheet.columns, 'end', 'finish', '종료', '마감');
    if (!startCol || !endCol) continue;
    if (startCol.type !== 'date' && endCol.type !== 'date') continue;
    const nameCol = matchCol(sheet.columns, 'name', 'title', '이름', '제목');
    return { sheet, startCol, endCol, nameCol };
  }
  return null;
}

/** 오늘 기준 current / previous / next cycle 판별 */
export function detectCurrent(ctx: CyclesContext): DetectedCycles {
  const today = todayStart().getTime();
  const rows = ctx.sheet.rows.filter((r) => {
    const s = parseDate(r.cells[ctx.startCol.id]);
    const e = parseDate(r.cells[ctx.endCol.id]);
    return s && e;
  });

  // 정렬: start 오름차순
  rows.sort((a, b) => {
    const sa = parseDate(a.cells[ctx.startCol.id])!.getTime();
    const sb = parseDate(b.cells[ctx.startCol.id])!.getTime();
    return sa - sb;
  });

  let current: Row | undefined;
  let previous: Row | undefined;
  let next: Row | undefined;

  for (const r of rows) {
    const s = parseDate(r.cells[ctx.startCol.id])!.getTime();
    const e = parseDate(r.cells[ctx.endCol.id])!.getTime();
    if (today >= s && today <= e) {
      current = r;
    } else if (e < today) {
      previous = r; // 끝난 것 중 가장 최근
    } else if (s > today && !next) {
      next = r; // 시작 예정인 것 중 가장 빠른 것
    }
  }

  return { current, previous, next, all: rows };
}

/** 해당 cycle row id 에 연결된 이슈 (task-link / link 타입 컬럼 기준) */
export function findIssuesForCycle(
  project: Project,
  cycleRowId: string,
): Array<{ sheet: Sheet; row: Row; cycleColumnId: string; statusColumnId?: string }> {
  const out: Array<{ sheet: Sheet; row: Row; cycleColumnId: string; statusColumnId?: string }> = [];
  for (const sheet of project.sheets) {
    const cycleCol = sheet.columns.find(
      (c) =>
        (c.type === 'task-link' || c.type === 'link') &&
        /cycle|sprint|사이클|스프린트/i.test(c.name),
    );
    if (!cycleCol) continue;
    const statusCol = sheet.columns.find(
      (c) => c.type === 'select' && /status|상태/i.test(c.name),
    );
    for (const row of sheet.rows) {
      const v = row.cells[cycleCol.id];
      if (!v) continue;
      const ids = String(v).split(',').map((s) => s.trim());
      if (ids.includes(cycleRowId)) {
        out.push({
          sheet,
          row,
          cycleColumnId: cycleCol.id,
          statusColumnId: statusCol?.id,
        });
      }
    }
  }
  return out;
}

/** 이슈가 done 상태인지 — cell 값이 done/완료/closed/complete 계열 */
export function isIssueDone(row: Row, statusColumnId: string | undefined, statusCol?: Column): boolean {
  if (!statusColumnId) return false;
  const v = row.cells[statusColumnId];
  if (v === null || v === undefined || v === '') return false;
  const s = String(v).toLowerCase().trim();
  if (/^(done|closed|complete|completed|fixed)$/.test(s)) return true;
  // select option id/label 둘 다 체크
  if (statusCol?.selectOptions) {
    const opt = statusCol.selectOptions.find((o) => o.id === s || o.label.toLowerCase() === s);
    if (opt) {
      const label = opt.label.toLowerCase();
      return /done|완료|closed|complete|fixed/.test(label);
    }
  }
  return /완료/.test(s);
}

/**
 * 미완료 이슈 이관 — from cycle 의 done 아닌 이슈들의 cycle 컬럼을 toCycleId 로 일괄 변경.
 * updateCell 콜백을 외부에서 주입 받음 (store 의존성 분리).
 */
export function carryOverUnfinished(
  project: Project,
  fromCycleId: string,
  toCycleId: string,
  updateCell: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    value: string,
  ) => void,
): number {
  const issues = findIssuesForCycle(project, fromCycleId);
  let movedCount = 0;
  for (const { sheet, row, cycleColumnId, statusColumnId } of issues) {
    const statusCol = sheet.columns.find((c) => c.id === statusColumnId);
    if (isIssueDone(row, statusColumnId, statusCol)) continue;
    // 값이 CSV 면 fromCycleId 를 toCycleId 로 교체 (다른 id 는 유지)
    const v = row.cells[cycleColumnId];
    const ids = String(v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const replaced = ids.map((id) => (id === fromCycleId ? toCycleId : id));
    updateCell(project.id, sheet.id, row.id, cycleColumnId, replaced.join(','));
    movedCount += 1;
  }
  return movedCount;
}

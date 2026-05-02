/**
 * 번다운 차트 분석 — PM 스프린트 시트 + changelog 시계열 기반.
 *
 * 입력: 시트의 현재 상태 + 프로젝트의 changelog
 * 출력: 일자별 { remaining, ideal } 데이터 포인트
 *
 * 핵심 로직:
 *   1. 시트에서 start/end 날짜 컬럼 추정 → 없으면 changelog 기간으로 fallback
 *   2. 각 row 의 "done 전환 시점" 을 changelog 역재생으로 계산
 *   3. 스프린트 각 날짜별 open task 수 (또는 story points 합)
 *   4. ideal line: total(start) → 0(end) 선형 보간
 */

import type { Sheet, Column, Row, ChangeEntry, CellValue } from '@/types';
import { detectPmSheet, isActiveRow } from './pmSheetDetection';

export interface BurndownPoint {
  date: string;        // 'YYYY-MM-DD'
  ts: number;          // epoch ms (자정 기준)
  remaining: number;   // 그 날 기준 open 태스크의 총 points (또는 태스크 수)
  ideal: number;       // 이상적 감소 라인
}

export interface BurndownInput {
  sheet: Sheet;
  changelog: ChangeEntry[];
  /** 포인트 단위 ('points' 컬럼 사용) 또는 태스크 수. undefined = auto */
  unit?: 'points' | 'count';
}

export interface BurndownResult {
  points: BurndownPoint[];
  totalStart: number;          // 스프린트 시작 시점의 총 points
  completed: number;           // 오늘까지 완료된 points
  startDate: string;
  endDate: string;
  unit: 'points' | 'count';
  /** 시트가 번다운 분석 대상인지 (sprint 타입 + status 컬럼 필요) */
  eligible: boolean;
  /** 분석 불가 사유 */
  reason?: string;
}

// 컬럼 이름 heuristic
function findDateColumn(cols: Column[], keywords: string[]): Column | undefined {
  const normalized = keywords.map((k) => k.toLowerCase());
  return cols.find((c) => {
    if (c.type !== 'date' && c.type !== 'general') return false;
    const cn = c.name.toLowerCase();
    return normalized.some((k) => cn.includes(k));
  });
}

function findPointsColumn(cols: Column[]): Column | undefined {
  return cols.find((c) => {
    const cn = c.name.toLowerCase();
    return /\b(points?|sp|story.?points?|estimate|포인트)\b/.test(cn);
  });
}

function toMidnight(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(v: CellValue): number | null {
  if (v === null || v === '' || v === undefined) return null;
  const s = String(v).trim();
  const ts = Date.parse(s);
  return Number.isFinite(ts) ? ts : null;
}

function pointsOf(row: Row, pointsCol: Column | undefined): number {
  if (!pointsCol) return 1;
  const v = row.cells[pointsCol.id];
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// "done" 으로 간주할 값들 (case-insensitive)
const DONE_VALUES = new Set([
  'done', 'closed', 'cancelled', 'canceled', 'resolved', '완료', '닫힘', '종료',
]);

function isDoneValue(v: CellValue): boolean {
  if (v === null || v === '' || v === undefined) return false;
  return DONE_VALUES.has(String(v).toLowerCase());
}

export function analyzeBurndown(input: BurndownInput): BurndownResult {
  const { sheet, changelog, unit: unitPref } = input;

  const pm = detectPmSheet(sheet);
  if (pm.type !== 'sprint' && pm.type !== 'generic-pm') {
    return {
      points: [],
      totalStart: 0,
      completed: 0,
      startDate: '',
      endDate: '',
      unit: 'count',
      eligible: false,
      reason: 'PM 스프린트 시트가 아닙니다',
    };
  }
  if (!pm.statusColumnId) {
    return {
      points: [],
      totalStart: 0,
      completed: 0,
      startDate: '',
      endDate: '',
      unit: 'count',
      eligible: false,
      reason: 'status 컬럼을 찾을 수 없습니다',
    };
  }

  const pointsCol = findPointsColumn(sheet.columns);
  const unit: 'points' | 'count' = unitPref ?? (pointsCol ? 'points' : 'count');

  // 시작일/종료일 추정
  const startCol = findDateColumn(sheet.columns, ['start', '시작', 'begin']);
  const endCol = findDateColumn(sheet.columns, ['end', '종료', 'due', 'deadline', 'finish']);

  // row 들의 start/end 후보에서 범위 추출
  let startTs: number | null = null;
  let endTs: number | null = null;
  if (startCol) {
    for (const row of sheet.rows) {
      const t = parseDate(row.cells[startCol.id]);
      if (t !== null && (startTs === null || t < startTs)) startTs = t;
    }
  }
  if (endCol) {
    for (const row of sheet.rows) {
      const t = parseDate(row.cells[endCol.id]);
      if (t !== null && (endTs === null || t > endTs)) endTs = t;
    }
  }

  // 시트 changelog 만 필터 — 해당 status 컬럼으로의 변경
  const sheetLog = changelog
    .filter((e) => e.sheetId === sheet.id && e.columnId === pm.statusColumnId)
    .sort((a, b) => a.timestamp - b.timestamp);

  // fallback: changelog 의 timestamp 범위
  if (startTs === null && sheetLog.length > 0) {
    startTs = sheetLog[0].timestamp;
  }
  if (endTs === null && sheetLog.length > 0) {
    endTs = sheetLog[sheetLog.length - 1].timestamp;
  }

  // 여전히 없으면 createdAt/updatedAt 사용
  if (startTs === null) startTs = sheet.createdAt;
  if (endTs === null) endTs = Math.max(sheet.updatedAt, Date.now());

  // 종료일이 시작일보다 이르면 +7일 기본 스프린트
  if (endTs <= startTs) endTs = startTs + 7 * 86_400_000;

  startTs = toMidnight(startTs);
  endTs = toMidnight(endTs);

  // 스프린트에 속한 row 만 (start/end 컬럼이 있으면 필터, 없으면 전체)
  const inSprint = sheet.rows.filter((row) => {
    if (!startCol && !endCol) return true;
    let rowStart = startCol ? parseDate(row.cells[startCol.id]) : null;
    let rowEnd = endCol ? parseDate(row.cells[endCol.id]) : null;
    rowStart = rowStart !== null ? toMidnight(rowStart) : null;
    rowEnd = rowEnd !== null ? toMidnight(rowEnd) : null;
    // 느슨한 교집합: row 기간이 스프린트와 겹치면 포함
    if (rowStart !== null && rowStart > endTs!) return false;
    if (rowEnd !== null && rowEnd < startTs!) return false;
    return true;
  });

  // 각 row 의 "done 된 최초 timestamp" — changelog 역재생으로 추정
  const doneAt = new Map<string, number>(); // rowId -> ts (done 으로 전환된 시점)
  const statusHistory = new Map<string, Array<{ ts: number; value: CellValue }>>();
  for (const e of sheetLog) {
    if (!statusHistory.has(e.rowId)) statusHistory.set(e.rowId, []);
    statusHistory.get(e.rowId)!.push({ ts: e.timestamp, value: e.after });
  }
  // 현재 done 상태이면, 역순으로 돌려서 "가장 마지막 done 전환" 시점 찾기
  for (const row of inSprint) {
    const currentlyDone = isDoneValue(row.cells[pm.statusColumnId!]);
    if (!currentlyDone) continue;
    const hist = statusHistory.get(row.id);
    if (hist && hist.length > 0) {
      // 마지막 done 전환 찾기 — 뒤에서부터 non-done 을 만날 때까지
      let lastDone = hist[hist.length - 1].ts;
      for (let i = hist.length - 1; i >= 0; i--) {
        if (isDoneValue(hist[i].value)) {
          lastDone = hist[i].ts;
        } else {
          break;
        }
      }
      doneAt.set(row.id, lastDone);
    } else {
      // changelog 없으면 updatedAt 또는 지금 시각으로 가정
      doneAt.set(row.id, sheet.updatedAt ?? Date.now());
    }
  }

  // 일자별 번다운 포인트
  const points: BurndownPoint[] = [];
  const totalStart = inSprint.reduce((sum, row) => {
    return sum + (unit === 'points' ? pointsOf(row, pointsCol) : 1);
  }, 0);

  const dayMs = 86_400_000;
  const today = toMidnight(Date.now());
  // 차트는 스프린트 종료일 또는 오늘까지 (더 이른 쪽)
  const drawUntil = Math.max(startTs, Math.min(endTs, today));
  const totalDays = Math.max(1, Math.round((endTs - startTs) / dayMs));

  for (let ts = startTs; ts <= drawUntil; ts += dayMs) {
    const endOfDay = ts + dayMs - 1;
    const completed = inSprint.reduce((sum, row) => {
      const doneTs = doneAt.get(row.id);
      if (doneTs === undefined) return sum;
      if (doneTs > endOfDay) return sum;
      return sum + (unit === 'points' ? pointsOf(row, pointsCol) : 1);
    }, 0);

    const dayIndex = Math.round((ts - startTs) / dayMs);
    const idealRemaining = Math.max(0, totalStart - (totalStart / totalDays) * dayIndex);

    points.push({
      date: formatDate(ts),
      ts,
      remaining: totalStart - completed,
      ideal: Math.round(idealRemaining * 100) / 100,
    });
  }

  // 오늘까지만 그리고, 남은 기간은 ideal 만 있는 점선으로? — 차트 컴포넌트에서 처리.
  // 여기서는 오늘 이후의 ideal 도 포함시켜 차트가 전 기간 보여주도록 확장
  for (let ts = drawUntil + dayMs; ts <= endTs; ts += dayMs) {
    const dayIndex = Math.round((ts - startTs) / dayMs);
    const idealRemaining = Math.max(0, totalStart - (totalStart / totalDays) * dayIndex);
    points.push({
      date: formatDate(ts),
      ts,
      remaining: Number.NaN, // 미래는 unknown → 차트가 연결 안 함
      ideal: Math.round(idealRemaining * 100) / 100,
    });
  }

  const completedTotal = inSprint.reduce((sum, row) => {
    const active = isActiveRow(row, pm.statusColumnId);
    if (active) return sum;
    return sum + (unit === 'points' ? pointsOf(row, pointsCol) : 1);
  }, 0);

  return {
    points,
    totalStart,
    completed: completedTotal,
    startDate: formatDate(startTs),
    endDate: formatDate(endTs),
    unit,
    eligible: true,
  };
}

/**
 * Velocity 분석 — 지난 N 개 cycle/sprint 의 완료 story points 합계.
 *
 * 입력: 프로젝트의 PM 시트들 + changelog
 * 출력: cycle 라벨별 { completedPoints, totalPoints, completionRate }
 *
 * 동작:
 *   1. PM 시트 (sprint 또는 generic-pm) 에서 row 수집
 *   2. status 가 done/완료 로 전환된 changelog 항목 → 완료 일자 추정
 *   3. sprint 라벨 (시트 이름 또는 cycle 컬럼 값) 별로 그룹핑
 *   4. 각 그룹의 총 points vs 완료 points
 */

import type { Sheet, Column, ChangeEntry, Project } from '@/types';
import { detectPmSheet } from './pmSheetDetection';

export interface VelocityPoint {
  /** Sprint/Cycle 라벨 — 시트명 또는 cycle 컬럼 값 */
  label: string;
  /** 시작 시각 (정렬용) */
  sortTs: number;
  /** 총 기획 points (또는 태스크 수) */
  totalPoints: number;
  /** 완료된 points */
  completedPoints: number;
  /** 완료 비율 0~1 */
  completionRate: number;
  /** 유닛 */
  unit: 'points' | 'count';
}

export interface VelocityResult {
  points: VelocityPoint[];
  /** 평균 velocity (최근 N 개) */
  averageCompleted: number;
  /** 사용 가능한지 */
  eligible: boolean;
  reason?: string;
}

function isDoneStatus(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).toLowerCase().trim();
  return s === 'done' || s === '완료' || s === 'closed' || s === 'complete' || s === 'completed';
}

function findPointsColumn(cols: Column[]): Column | undefined {
  return cols.find((c) => {
    const cn = c.name.toLowerCase();
    return /\b(points?|sp|story.?points?|estimate|포인트)\b/.test(cn);
  });
}

function findStatusColumn(cols: Column[]): Column | undefined {
  return cols.find(
    (c) => c.type === 'select' && /status|state|상태/.test(c.name.toLowerCase()),
  );
}

/**
 * 프로젝트 전체에서 velocity 계산.
 * 각 PM 시트를 하나의 sprint 로 간주 — 시트명이 라벨.
 */
export function analyzeVelocity(project: Project, lastN = 6): VelocityResult {
  const pmSheets = project.sheets.filter((s) => {
    const pm = detectPmSheet(s);
    return pm.type === 'sprint' || pm.type === 'generic-pm';
  });

  if (pmSheets.length === 0) {
    return {
      points: [],
      averageCompleted: 0,
      eligible: false,
      reason: 'PM 시트 없음',
    };
  }

  const changelog = project.changelog ?? [];
  const doneTimeByRow = new Map<string, number>();

  // changelog 에서 status='done' 로 전환된 시점 찾기
  for (const entry of changelog) {
    if (isDoneStatus(entry.after) && !isDoneStatus(entry.before)) {
      const existing = doneTimeByRow.get(entry.rowId);
      if (existing === undefined || entry.timestamp < existing) {
        doneTimeByRow.set(entry.rowId, entry.timestamp);
      }
    }
  }

  const results: VelocityPoint[] = [];
  for (const sheet of pmSheets) {
    const pointsCol = findPointsColumn(sheet.columns);
    const statusCol = findStatusColumn(sheet.columns);
    if (!statusCol) continue;

    const unit: 'points' | 'count' = pointsCol ? 'points' : 'count';

    let totalPoints = 0;
    let completedPoints = 0;
    let earliestTs = Number.MAX_SAFE_INTEGER;

    for (const row of sheet.rows) {
      const p = pointsCol
        ? Number(row.cells[pointsCol.id] ?? 0) || 0
        : 1;
      totalPoints += p;

      const statusVal = row.cells[statusCol.id];
      if (isDoneStatus(statusVal)) {
        completedPoints += p;
        const doneTs = doneTimeByRow.get(row.id);
        if (doneTs && doneTs < earliestTs) earliestTs = doneTs;
      }
    }

    if (earliestTs === Number.MAX_SAFE_INTEGER) earliestTs = sheet.updatedAt;

    results.push({
      label: sheet.name,
      sortTs: earliestTs,
      totalPoints,
      completedPoints,
      completionRate: totalPoints > 0 ? completedPoints / totalPoints : 0,
      unit,
    });
  }

  // 시간순 정렬 (오래된 것부터) → 최근 N 개
  results.sort((a, b) => a.sortTs - b.sortTs);
  const recent = results.slice(-lastN);
  const averageCompleted =
    recent.length > 0
      ? recent.reduce((s, p) => s + p.completedPoints, 0) / recent.length
      : 0;

  return {
    points: recent,
    averageCompleted: Math.round(averageCompleted * 10) / 10,
    eligible: recent.length > 0,
    reason: recent.length === 0 ? 'Status 컬럼 있는 PM 시트 없음' : undefined,
  };
}

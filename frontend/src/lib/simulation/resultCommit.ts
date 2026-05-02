/**
 * 시뮬 결과를 시트 row 로 commit — 1v1 + 팀 통합.
 *
 * 동작:
 *  - 컬럼 이름 alias 매칭 (영/한)으로 metric 을 셀에 매핑
 *  - 매칭 컬럼 없으면 자동 추가 (옵션) — addColumn 콜백 제공 시
 *  - stat-snapshot 컬럼 있으면 JSON 으로 전체 payload 저장
 *  - 매칭이 전혀 없을 땐 첫 general 컬럼에 요약 텍스트 fallback
 */

import type { Column, Sheet } from '@/types';
import type { SimulationResult, UnitStats } from './types';

interface CommitContext {
  sheet: Sheet;
  /** 셀 값 push */
  addRow: (cells: Record<string, string | number>) => string | undefined;
  /** 누락 컬럼 자동 추가 (선택). 제공 시 매칭 안 된 metric 마다 컬럼 생성. */
  addColumn?: (data: Pick<Column, 'name' | 'type'>) => Column | null;
}

/** 컬럼 이름 정규화 — 매칭 비교용 */
function norm(name: string): string {
  return name.toLowerCase().replace(/[\s_\-/]/g, '');
}

/** sheet 에서 alias 중 하나라도 매칭되는 컬럼 찾기 */
function findColumn(sheet: Sheet, ...aliases: string[]): Column | undefined {
  const needles = aliases.map(norm);
  return sheet.columns.find((c) => {
    const cn = norm(c.name);
    return needles.some((n) => cn === n || cn.includes(n));
  });
}

/** 매칭 컬럼이 없으면 addColumn 으로 생성. addColumn 이 없으면 undefined. */
function ensureColumn(
  ctx: CommitContext,
  newColName: string,
  type: Column['type'],
  ...aliases: string[]
): Column | undefined {
  const existing = findColumn(ctx.sheet, ...aliases);
  if (existing) return existing;
  if (!ctx.addColumn) return undefined;
  return ctx.addColumn({ name: newColName, type }) ?? undefined;
}

/** 1v1 시뮬 결과 commit. 매칭/생성된 컬럼에 metric push. */
export function commit1v1Result(
  ctx: CommitContext,
  result: SimulationResult,
  unit1: UnitStats,
  unit2: UnitStats,
): string | undefined {
  const payload = {
    timestamp: new Date().toISOString(),
    unit1: unit1.name || 'Unit 1',
    unit2: unit2.name || 'Unit 2',
    winRate: Math.round((result.unit1WinRate ?? 0) * 100) / 100,
    avgDuration: Math.round((result.avgDuration ?? 0) * 100) / 100,
    totalRuns: result.totalRuns,
  };

  const cells: Record<string, string | number> = {};
  const tsCol = ensureColumn(ctx, '일시', 'date', 'timestamp', 'date', '일시', '날짜');
  const u1Col = ensureColumn(ctx, 'Unit 1', 'general', 'unit1', 'attacker', '유닛1', '공격');
  const u2Col = ensureColumn(ctx, 'Unit 2', 'general', 'unit2', 'defender', '유닛2', '방어');
  const wrCol = ensureColumn(ctx, 'Win Rate', 'general', 'winrate', 'win', '승률');
  const durCol = ensureColumn(ctx, 'Avg Duration', 'general', 'duration', 'time', '시간', '소요');
  const runsCol = ensureColumn(ctx, 'Runs', 'general', 'runs', 'iterations', 'samples', '반복');
  const snapCol = ctx.sheet.columns.find((c) => c.type === 'stat-snapshot');

  if (tsCol) cells[tsCol.id] = payload.timestamp;
  if (u1Col) cells[u1Col.id] = payload.unit1;
  if (u2Col) cells[u2Col.id] = payload.unit2;
  if (wrCol) cells[wrCol.id] = payload.winRate;
  if (durCol) cells[durCol.id] = payload.avgDuration;
  if (runsCol) cells[runsCol.id] = payload.totalRuns;
  if (snapCol) {
    cells[snapCol.id] = JSON.stringify({
      capturedAt: Date.now(),
      sourceRowId: '',
      stats: payload,
      label: `${payload.unit1} vs ${payload.unit2}`,
    });
  }

  if (Object.keys(cells).length === 0) {
    const textCol = ctx.sheet.columns.find((c) => c.type === 'general');
    if (textCol) cells[textCol.id] = `${payload.unit1} vs ${payload.unit2} · WR ${payload.winRate}%`;
  }

  return ctx.addRow(cells);
}

/** 팀 시뮬 결과 commit. team-level metric (win-rate / damage / survivors / duration). */
export function commitTeamResult(
  ctx: CommitContext,
  result: {
    team1WinRate: number;
    team2WinRate: number;
    draws: number;
    totalRuns: number;
    avgDuration?: number;
    avgTeam1Damage?: number;
    avgTeam2Damage?: number;
    avgTeam1Survivors?: number;
    avgTeam2Survivors?: number;
  },
  team1Name: string,
  team2Name: string,
): string | undefined {
  const payload = {
    timestamp: new Date().toISOString(),
    team1: team1Name,
    team2: team2Name,
    team1WinRate: Math.round(result.team1WinRate * 10000) / 100, // % 표기
    team2WinRate: Math.round(result.team2WinRate * 10000) / 100,
    draws: result.draws,
    totalRuns: result.totalRuns,
    avgDuration: result.avgDuration ? Math.round(result.avgDuration * 100) / 100 : 0,
    avgTeam1Damage: Math.round(result.avgTeam1Damage ?? 0),
    avgTeam2Damage: Math.round(result.avgTeam2Damage ?? 0),
    avgTeam1Survivors: result.avgTeam1Survivors !== undefined ? Math.round(result.avgTeam1Survivors * 100) / 100 : 0,
    avgTeam2Survivors: result.avgTeam2Survivors !== undefined ? Math.round(result.avgTeam2Survivors * 100) / 100 : 0,
  };

  const cells: Record<string, string | number> = {};
  const tsCol = ensureColumn(ctx, '일시', 'date', 'timestamp', '일시', '날짜');
  const t1Col = ensureColumn(ctx, 'Team 1', 'general', 'team1', '팀1');
  const t2Col = ensureColumn(ctx, 'Team 2', 'general', 'team2', '팀2');
  const t1WrCol = ensureColumn(ctx, 'Team 1 Win%', 'general', 'team1winrate', 'team1win', '팀1승률');
  const t2WrCol = ensureColumn(ctx, 'Team 2 Win%', 'general', 'team2winrate', 'team2win', '팀2승률');
  const drawCol = ensureColumn(ctx, 'Draws', 'general', 'draws', '무승부');
  const runsCol = ensureColumn(ctx, 'Runs', 'general', 'runs', 'iterations', '반복');
  const durCol = ensureColumn(ctx, 'Avg Duration', 'general', 'duration', 'time', '시간', '소요');
  const t1DmgCol = ensureColumn(ctx, 'Team 1 Damage', 'general', 'team1damage', '팀1데미지');
  const t2DmgCol = ensureColumn(ctx, 'Team 2 Damage', 'general', 'team2damage', '팀2데미지');
  const t1SurvCol = ensureColumn(ctx, 'Team 1 Surv', 'general', 'team1surv', 'team1survivors', '팀1생존');
  const t2SurvCol = ensureColumn(ctx, 'Team 2 Surv', 'general', 'team2surv', 'team2survivors', '팀2생존');
  const snapCol = ctx.sheet.columns.find((c) => c.type === 'stat-snapshot');

  if (tsCol) cells[tsCol.id] = payload.timestamp;
  if (t1Col) cells[t1Col.id] = payload.team1;
  if (t2Col) cells[t2Col.id] = payload.team2;
  if (t1WrCol) cells[t1WrCol.id] = payload.team1WinRate;
  if (t2WrCol) cells[t2WrCol.id] = payload.team2WinRate;
  if (drawCol) cells[drawCol.id] = payload.draws;
  if (runsCol) cells[runsCol.id] = payload.totalRuns;
  if (durCol) cells[durCol.id] = payload.avgDuration;
  if (t1DmgCol) cells[t1DmgCol.id] = payload.avgTeam1Damage;
  if (t2DmgCol) cells[t2DmgCol.id] = payload.avgTeam2Damage;
  if (t1SurvCol) cells[t1SurvCol.id] = payload.avgTeam1Survivors;
  if (t2SurvCol) cells[t2SurvCol.id] = payload.avgTeam2Survivors;
  if (snapCol) {
    cells[snapCol.id] = JSON.stringify({
      capturedAt: Date.now(),
      sourceRowId: '',
      stats: payload,
      label: `${payload.team1} vs ${payload.team2}`,
    });
  }

  if (Object.keys(cells).length === 0) {
    const textCol = ctx.sheet.columns.find((c) => c.type === 'general');
    if (textCol) {
      cells[textCol.id] = `${payload.team1} vs ${payload.team2} · ${payload.team1WinRate}% / ${payload.team2WinRate}%`;
    }
  }

  return ctx.addRow(cells);
}


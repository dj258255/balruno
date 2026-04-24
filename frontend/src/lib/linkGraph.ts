/**
 * link / lookup / rollup 체인에서 순환 참조 감지.
 *
 * 시트 간 link/lookup/rollup 의존 그래프를 구성한 뒤 DFS 로 사이클 탐지.
 * - link: linkedSheetId 로 edge
 * - lookup: lookupLinkColumnId 가 가리키는 link 컬럼 → lookupTargetColumnId 의 시트로 edge
 * - rollup: 동일 (집계 대상 시트로 edge)
 *
 * MAX_RECURSION_DEPTH(10) 가 이미 runtime 에 가드를 걸지만, 이 함수는
 * **설계 시점** (ColumnModal 저장, updateColumn) 에 즉시 경고를 띄우기 위한 도구.
 */

import type { Sheet, Column } from '@/types';

export interface CycleResult {
  hasCycle: boolean;
  /** 사이클을 이루는 시트 ID 순서 (A → B → A 면 [A, B, A]) */
  path: string[];
  /** 사람이 읽는 시트 이름 경로 */
  pathNames: string[];
}

/** 단일 컬럼의 의존 대상 시트 ID 반환 (없으면 null). */
function outgoingSheetId(column: Column, sheet: Sheet): string | null {
  if (column.type === 'link') return column.linkedSheetId ?? null;
  if (column.type === 'lookup' || column.type === 'rollup') {
    if (!column.lookupLinkColumnId) return null;
    // lookup 의 link 컬럼을 찾아서 그쪽 linkedSheetId 로 간주
    const linkCol = sheet.columns.find((c) => c.id === column.lookupLinkColumnId);
    return linkCol?.linkedSheetId ?? null;
  }
  return null;
}

/** 모든 컬럼 의존 그래프 (sheetId → Set<dep sheetId>). */
function buildGraph(sheets: Sheet[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const sheet of sheets) {
    const deps = new Set<string>();
    for (const col of sheet.columns) {
      const depId = outgoingSheetId(col, sheet);
      if (depId && depId !== sheet.id) deps.add(depId);
    }
    graph.set(sheet.id, deps);
  }
  return graph;
}

/** DFS 로 사이클 감지 — 주어진 시트 루트부터. */
function findCycle(
  rootId: string,
  graph: Map<string, Set<string>>,
  sheets: Sheet[],
): CycleResult {
  const visiting = new Set<string>();
  const path: string[] = [];

  const sheetName = (id: string) => sheets.find((s) => s.id === id)?.name ?? id.slice(0, 6);

  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      // 사이클! path 에 다시 시작점을 추가해 경로 완성
      path.push(nodeId);
      return true;
    }
    visiting.add(nodeId);
    path.push(nodeId);
    const deps = graph.get(nodeId) ?? new Set();
    for (const dep of deps) {
      if (dfs(dep)) return true;
    }
    visiting.delete(nodeId);
    path.pop();
    return false;
  }

  const found = dfs(rootId);
  if (!found) {
    return { hasCycle: false, path: [], pathNames: [] };
  }
  // path 는 마지막이 사이클 시작점
  const cycleStart = path[path.length - 1];
  const startIdx = path.indexOf(cycleStart);
  const cyclePath = path.slice(startIdx);
  return {
    hasCycle: true,
    path: cyclePath,
    pathNames: cyclePath.map(sheetName),
  };
}

/** 전체 시트 그래프에서 사이클 검사. 첫 번째 발견된 사이클 반환. */
export function detectLinkCycles(sheets: Sheet[]): CycleResult {
  const graph = buildGraph(sheets);
  for (const sheet of sheets) {
    const result = findCycle(sheet.id, graph, sheets);
    if (result.hasCycle) return result;
  }
  return { hasCycle: false, path: [], pathNames: [] };
}

/**
 * 특정 컬럼을 *추가 혹은 변경* 했을 때 사이클이 생기는지 사전 검사.
 * ColumnModal 저장 전에 호출.
 *
 * @param sheets 현재 모든 시트
 * @param sheetId 변경 대상 시트
 * @param proposedColumn 저장하려는 컬럼 (id 포함 — 기존 컬럼 교체 시)
 */
export function wouldCreateCycle(
  sheets: Sheet[],
  sheetId: string,
  proposedColumn: Column,
): CycleResult {
  // 변경된 시트로 교체한 버전의 sheets 에서 사이클 검사
  const modified = sheets.map((s) => {
    if (s.id !== sheetId) return s;
    const existingIdx = s.columns.findIndex((c) => c.id === proposedColumn.id);
    const nextColumns = existingIdx >= 0
      ? s.columns.map((c, i) => (i === existingIdx ? proposedColumn : c))
      : [...s.columns, proposedColumn];
    return { ...s, columns: nextColumns };
  });
  return detectLinkCycles(modified);
}

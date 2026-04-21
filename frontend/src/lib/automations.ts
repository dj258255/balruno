/**
 * Track 10 — Automations.
 *
 * 노드 기반 룰 파이프라인 (Trigger → Condition → Action).
 *
 * 노드 타입:
 *   Trigger:
 *     - cell-changed:  특정 시트/컬럼 값 변경 시 발동
 *     - row-added:     새 행 추가 시
 *     - manual:        수동 실행 버튼
 *
 *   Condition:
 *     - compare:       값 비교 (gt/lt/eq/contains)
 *     - threshold:     집계 함수 결과가 임계 초과
 *
 *   Action:
 *     - notify:        화면 우상단 토스트
 *     - update-cell:   다른 셀에 값 쓰기
 *     - log:           console + 로그 패널
 *     - webhook:       URL POST (curl 식 — 옵션)
 *
 * 실행: Trigger 발동 시 condition 체크 → 통과 시 action 순차 실행.
 *       (현재는 manual trigger 만 즉시 실행, cell-changed/row-added 는 Y.Doc observer 통합 시 활성)
 */

import type { Project, Sheet } from '@/types';
import { computeSheetRows } from './formulaEngine';
import { resolveNodeValue } from './diagramSheetBridge';

export type TriggerType =
  | 'cell-changed'
  | 'row-added'
  | 'manual'
  | 'schedule'
  | 'playtest-started'    // Track 13: playtest status → running
  | 'playtest-ended';     // Track 13: playtest status → done
export type ConditionType = 'compare' | 'threshold' | 'branch';
export type ActionType =
  | 'notify'
  | 'update-cell'
  | 'log'
  | 'webhook'
  | 'delay'
  | 'loop-rows'
  | 'calc'
  | 'snapshot-stats'      // Track 13: 현재 시트 stats 를 snapshot row 에 캡처
  | 'create-retro-task';  // Track 13: playtest 종료 후 회고 task 자동 생성
/** Probability Flow 노드 — Machinations 스타일.
 *  Track 15 확장: pool(자원 저장), converter(a→b 변환), trigger(조건 발동). */
export type FlowType = 'source' | 'gate' | 'sink' | 'pool' | 'converter' | 'trigger';
export type NodeType = 'trigger' | 'condition' | 'action' | 'flow';

export interface AutomationNode {
  id: string;
  type: NodeType;
  subtype: TriggerType | ConditionType | ActionType | FlowType;
  config: Record<string, unknown>;
  /** 시각적 위치 (그래프 뷰 후속 작업용) */
  position?: { x: number; y: number };
}

export interface AutomationEdge {
  from: string;
  to: string;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  /** 'automation' (기본) | 'flow' (Probability Flow Diagram). */
  mode?: 'automation' | 'flow';
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY_PREFIX = 'balruno:automations:';

export function loadAutomations(projectId: string): Automation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + projectId);
    if (!raw) return [];
    return JSON.parse(raw) as Automation[];
  } catch {
    return [];
  }
}

export function saveAutomations(projectId: string, list: Automation[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(list));
}

export function generateAutomationId(): string {
  return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 새 자동화 생성 — 비어있는 trigger 노드 1개와 함께. */
export function createBlankAutomation(name = '새 자동화'): Automation {
  const triggerId = generateNodeId();
  return {
    id: generateAutomationId(),
    name,
    enabled: false,
    nodes: [{
      id: triggerId,
      type: 'trigger',
      subtype: 'manual',
      config: {},
      position: { x: 0, y: 0 },
    }],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export interface ExecutionLog {
  timestamp: number;
  automationId: string;
  nodeId: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

/** 단일 자동화 실행. 노드를 trigger → 위상 정렬로 순회. */
export async function runAutomation(
  automation: Automation,
  project: Project,
  options: {
    /** notify action 콜백 */
    onNotify?: (message: string) => void;
    /** update-cell action 콜백 (실제 store 업데이트) */
    onUpdateCell?: (sheetId: string, rowId: string, columnId: string, value: unknown) => void;
  } = {},
): Promise<ExecutionLog[]> {
  const logs: ExecutionLog[] = [];
  const log = (nodeId: string, message: string, level: ExecutionLog['level'] = 'info') => {
    logs.push({ timestamp: Date.now(), automationId: automation.id, nodeId, message, level });
  };

  // 노드 맵
  const nodeMap = new Map(automation.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const edge of automation.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  // BFS from trigger
  const trigger = automation.nodes.find((n) => n.type === 'trigger');
  if (!trigger) {
    log('-', '트리거 노드가 없습니다', 'error');
    return logs;
  }

  log(trigger.id, `트리거 발동: ${trigger.subtype}`);

  const queue = [trigger.id];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // condition 평가
    if (node.type === 'condition') {
      const passed = evaluateCondition(node, project);
      log(node.id, `조건 ${node.subtype}: ${passed ? '통과' : '실패'}`, passed ? 'info' : 'warn');
      if (!passed) continue; // 조건 실패 시 다운스트림 차단
    }

    // action 실행
    if (node.type === 'action') {
      try {
        await executeAction(node, project, options);
        log(node.id, `액션 ${node.subtype} 실행 완료`);
      } catch (e) {
        log(node.id, `액션 실패: ${e instanceof Error ? e.message : String(e)}`, 'error');
        continue;
      }
    }

    // 다음 노드들 enqueue
    const next = adjacency.get(nodeId) ?? [];
    for (const n of next) queue.push(n);
  }

  return logs;
}

function evaluateCondition(node: AutomationNode, project: Project): boolean {
  if (node.subtype === 'compare') {
    const { sheetId, column, op, value } = node.config as {
      sheetId: string; column: string; op: string; value: number | string;
    };
    const sheet = project.sheets.find((s) => s.id === sheetId);
    if (!sheet) return false;
    const computed = computeSheetRows(sheet, project.sheets);
    // 첫 행 기준 비교 (간단화)
    const cell = computed[0]?.[column];
    if (cell === undefined) return false;
    return compareValues(cell, op, value);
  }
  if (node.subtype === 'threshold') {
    const { sheetId, column, agg, threshold } = node.config as {
      sheetId: string; column: string; agg: string; threshold: number;
    };
    const sheet = project.sheets.find((s) => s.id === sheetId);
    if (!sheet) return false;
    const nums = aggregateColumn(sheet, project.sheets, column, agg);
    return nums > threshold;
  }
  return true;
}

function compareValues(a: unknown, op: string, b: unknown): boolean {
  const na = Number(a);
  const nb = Number(b);
  const numeric = !isNaN(na) && !isNaN(nb);
  switch (op) {
    case 'gt': return numeric && na > nb;
    case 'lt': return numeric && na < nb;
    case 'gte': return numeric && na >= nb;
    case 'lte': return numeric && na <= nb;
    case 'eq': return String(a) === String(b);
    case 'neq': return String(a) !== String(b);
    case 'contains': return String(a).includes(String(b));
    default: return false;
  }
}

function aggregateColumn(sheet: Sheet, sheets: Sheet[], column: string, agg: string): number {
  const computed = computeSheetRows(sheet, sheets);
  const nums = computed.map((r) => Number(r[column])).filter((n) => !isNaN(n));
  if (nums.length === 0) return 0;
  switch (agg) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    case 'count': return nums.length;
    default: return 0;
  }
}

async function executeAction(
  node: AutomationNode,
  project: Project,
  options: {
    onNotify?: (message: string) => void;
    onUpdateCell?: (sheetId: string, rowId: string, columnId: string, value: unknown) => void;
  },
): Promise<void> {
  const cfg = node.config as Record<string, unknown>;

  if (node.subtype === 'notify') {
    const msg = (cfg.message as string) ?? '자동화 알림';
    options.onNotify?.(msg);
    return;
  }

  if (node.subtype === 'log') {
    const msg = (cfg.message as string) ?? '로그';
    console.log('[Automation]', msg);
    return;
  }

  if (node.subtype === 'update-cell') {
    const { sheetId, rowId, columnId, value } = cfg as {
      sheetId: string; rowId: string; columnId: string; value: unknown;
    };
    if (!sheetId || !rowId || !columnId) throw new Error('update-cell 설정 미완료');
    options.onUpdateCell?.(sheetId, rowId, columnId, value);
    return;
  }

  if (node.subtype === 'webhook') {
    const { url, method = 'POST', body } = cfg as {
      url: string; method?: string; body?: unknown;
    };
    if (!url) throw new Error('webhook URL 미지정');
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return;
  }

  if (node.subtype === 'delay') {
    const ms = Number(cfg.ms ?? 1000);
    await new Promise((r) => setTimeout(r, Math.max(0, ms)));
    return;
  }

  if (node.subtype === 'loop-rows') {
    const { sheetId, limit = 100 } = cfg as { sheetId: string; limit?: number };
    const sheet = project.sheets.find((s) => s.id === sheetId);
    if (!sheet) throw new Error(`loop-rows: 시트 ${sheetId} 찾을 수 없음`);
    const cnt = Math.min(sheet.rows.length, Number(limit));
    options.onNotify?.(`loop-rows: ${cnt}행 순회 시작`);
    // 실제 순회는 caller 에서 (runAutomation) edge 재귀 형태로는 복잡하므로 notify 로 시그널만.
    return;
  }

  if (node.subtype === 'calc') {
    const { expr, label = 'calc' } = cfg as { expr: string; label?: string };
    if (!expr) throw new Error('calc: expr 누락');
    try {
      const { evaluate } = await import('mathjs');
      const result = evaluate(expr) as number;
      options.onNotify?.(`${label}: ${typeof result === 'number' ? result.toFixed(2) : String(result)}`);
    } catch (e) {
      throw new Error(`calc 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
    return;
  }

  if (node.subtype === 'snapshot-stats') {
    // Track 13: 소스 시트의 특정 row stats 를 JSON 으로 캡처.
    // caller 는 이 action 의 notify 콜백에서 구조화된 JSON 을 받아 snapshot 셀에 저장.
    const { sourceSheetId, sourceRowId, targetSheetId, targetRowId, targetColumnId } = cfg as {
      sourceSheetId: string; sourceRowId: string;
      targetSheetId: string; targetRowId: string; targetColumnId: string;
    };
    if (!sourceSheetId || !sourceRowId) {
      throw new Error('snapshot-stats: sourceSheetId/sourceRowId 누락');
    }
    const sourceSheet = project.sheets.find((s) => s.id === sourceSheetId);
    const sourceRow = sourceSheet?.rows.find((r) => r.id === sourceRowId);
    if (!sourceSheet || !sourceRow) {
      throw new Error('snapshot-stats: source 를 찾을 수 없음');
    }
    const stats: Record<string, string | number> = {};
    for (const col of sourceSheet.columns) {
      const v = sourceRow.cells[col.id];
      if (typeof v === 'number' || typeof v === 'string') stats[col.id] = v;
    }
    const payload = JSON.stringify({
      capturedAt: Date.now(),
      sourceRowId,
      stats,
      label: `Snapshot ${new Date().toLocaleDateString('ko-KR')}`,
    });
    if (targetSheetId && targetRowId && targetColumnId) {
      options.onUpdateCell?.(targetSheetId, targetRowId, targetColumnId, payload);
    } else {
      options.onNotify?.(`snapshot-stats 완료 (타겟 셀 미지정 — 로그만): ${Object.keys(stats).length}개 stats 캡처`);
    }
    return;
  }

  if (node.subtype === 'create-retro-task') {
    const { title, description } = cfg as { title: string; description?: string };
    // Task 시트에 row 를 insert 하는 건 slice 경유 필요. 일단 notify 로 제안.
    options.onNotify?.(`회고 태스크 제안: ${title}${description ? ` — ${description}` : ''}`);
    return;
  }

  void project;
}

// ============================================================================
// Probability Flow Diagram — Source → Gate → Sink Monte Carlo.
//
// 노드 config:
//   source: { rate: number }              — 매 iteration N개 토큰 생성
//   gate:   { probability: number, multiplier: number } — 통과 확률 + 배수
//   sink:   { label: string }             — 단순 누적
//
// 실행: BFS — source 출력을 edges 따라 다음 노드로 전달.
// ============================================================================

export interface FlowSimResult {
  /** sink 노드별 누적 토큰 수 */
  sinkTotals: Record<string, number>;
  /** sink 노드별 평균 (iterations 로 나눔) */
  sinkAverages: Record<string, number>;
  /** 각 edge 평균 throughput */
  edgeFlow: Record<string, number>;
  iterations: number;
}

export function simulateFlow(
  automation: Automation,
  iterations: number = 1000,
  sheets: Sheet[] = [],
): FlowSimResult {
  const nodeMap = new Map(automation.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const edge of automation.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }
  const sources = automation.nodes.filter((n) => n.type === 'flow' && n.subtype === 'source');
  const sinkTotals: Record<string, number> = {};
  const edgeFlow: Record<string, number> = {};
  for (const n of automation.nodes) if (n.subtype === 'sink') sinkTotals[n.id] = 0;

  for (let iter = 0; iter < iterations; iter++) {
    // BFS — token volume 누적
    const tokens = new Map<string, number>();
    for (const src of sources) {
      // Track 15-3: rate 가 sheet ref 면 resolve
      const rawRate = (src.config as { rate?: unknown }).rate;
      const resolved = resolveNodeValue(rawRate, sheets, 1);
      tokens.set(src.id, resolved);
    }

    const queue = sources.map((s) => s.id);
    const visited = new Set<string>();
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      let amount = tokens.get(nodeId) ?? 0;

      if (node.type === 'flow') {
        if (node.subtype === 'gate') {
          const prob = resolveNodeValue((node.config as { probability?: unknown }).probability, sheets, 1);
          const mult = resolveNodeValue((node.config as { multiplier?: unknown }).multiplier, sheets, 1);
          if (amount > 50) {
            const passExpected = amount * prob;
            const std = Math.sqrt(amount * prob * (1 - prob));
            const noise = (Math.random() + Math.random() + Math.random() - 1.5) * std;
            amount = Math.max(0, Math.round(passExpected + noise)) * mult;
          } else {
            let pass = 0;
            for (let k = 0; k < amount; k++) if (Math.random() < prob) pass++;
            amount = pass * mult;
          }
        } else if (node.subtype === 'sink') {
          sinkTotals[nodeId] = (sinkTotals[nodeId] ?? 0) + amount;
          continue;
        } else if (node.subtype === 'pool') {
          // 저장소: capacity 만큼만 받고 나머지 overflow
          const capacity = Number((node.config as { capacity?: number }).capacity ?? Infinity);
          const held = Math.min(amount, capacity);
          amount = held; // overflow 는 드롭
        } else if (node.subtype === 'converter') {
          // 입력 rate 만큼 소비해서 출력 rate 만큼 생성
          const inputRate = Number((node.config as { inputRate?: number }).inputRate ?? 1);
          const outputRate = Number((node.config as { outputRate?: number }).outputRate ?? 1);
          if (inputRate > 0) {
            const conversions = Math.floor(amount / inputRate);
            amount = conversions * outputRate;
          }
        } else if (node.subtype === 'trigger') {
          // 조건 토큰 통과 — 향후 조건 평가 추가. 현재는 pass-through.
        }
      }

      const next = adjacency.get(nodeId) ?? [];
      if (next.length === 0) continue;
      // 균등 분배
      const share = amount / next.length;
      for (const n of next) {
        tokens.set(n, (tokens.get(n) ?? 0) + share);
        const edgeKey = `${nodeId}->${n}`;
        edgeFlow[edgeKey] = (edgeFlow[edgeKey] ?? 0) + share;
        queue.push(n);
      }
    }
  }

  const sinkAverages: Record<string, number> = {};
  for (const k of Object.keys(sinkTotals)) sinkAverages[k] = sinkTotals[k] / iterations;
  for (const k of Object.keys(edgeFlow)) edgeFlow[k] = edgeFlow[k] / iterations;

  return { sinkTotals, sinkAverages, edgeFlow, iterations };
}

export function createBlankFlow(name = '새 확률 흐름'): Automation {
  const sourceId = generateNodeId();
  return {
    id: generateAutomationId(),
    name,
    enabled: true,
    mode: 'flow',
    nodes: [{
      id: sourceId,
      type: 'flow',
      subtype: 'source',
      config: { rate: 100 },
      position: { x: 0, y: 0 },
    }],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

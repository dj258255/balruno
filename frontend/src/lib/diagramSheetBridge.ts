/**
 * Track 15-3 — Diagram ↔ Sheet 양방향 연결.
 *
 * 노드의 rate/probability 값에 `=Sheet!colId!rowId` 형태의 참조를 허용.
 * - 읽기: resolveNodeValue(cfg.rate, sheets) → 실제 number
 * - 쓰기: 다이어그램에서 값 편집 시 해당 cell 업데이트 (changelog 기록됨)
 */

import type { Sheet } from '@/types';

export interface SheetRef {
  sheetId: string;
  columnId: string;
  rowId: string;
}

/**
 * `=Sheet!colId!rowId` 포맷 파싱. 아니면 null.
 * 편의를 위해 컬럼명/sheet 이름 기반도 허용.
 */
export function parseSheetRef(value: unknown): SheetRef | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s.startsWith('=')) return null;
  const parts = s.slice(1).split('!');
  if (parts.length !== 3) return null;
  const [sheetId, columnId, rowId] = parts.map((p) => p.trim());
  if (!sheetId || !columnId || !rowId) return null;
  return { sheetId, columnId, rowId };
}

/** 노드 config 의 값(숫자 또는 sheet 참조)을 실제 number 로 해석. */
export function resolveNodeValue(
  raw: unknown,
  sheets: Sheet[],
  fallback: number = 0,
): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const ref = parseSheetRef(raw);
  if (ref) {
    const sheet =
      sheets.find((s) => s.id === ref.sheetId) ??
      sheets.find((s) => s.name === ref.sheetId);
    const row = sheet?.rows.find((r) => r.id === ref.rowId);
    const col =
      sheet?.columns.find((c) => c.id === ref.columnId) ??
      sheet?.columns.find((c) => c.name === ref.columnId);
    if (!row || !col) return fallback;
    const v = row.cells[col.id];
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  // raw 가 string 이지만 `=` 없는 경우 숫자로 파싱 시도
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** SheetRef → `=sheet!col!row` 문자열. */
export function formatSheetRef(ref: SheetRef): string {
  return `=${ref.sheetId}!${ref.columnId}!${ref.rowId}`;
}

/**
 * 노드 config 의 모든 sheet ref 필드를 추출 (debug/UI 표시용).
 */
export function extractRefs(config: Record<string, unknown>): Array<{ key: string; ref: SheetRef }> {
  const out: Array<{ key: string; ref: SheetRef }> = [];
  for (const [k, v] of Object.entries(config)) {
    const r = parseSheetRef(v);
    if (r) out.push({ key: k, ref: r });
  }
  return out;
}

/**
 * 문서 @참조 파서 — Phase A.
 *
 * Syntax:
 *   @sheet:<SheetName>/<ColumnName>/<RowIndex>   → 셀 값 inline
 *   @sheet:<SheetName>                            → 시트 전체 링크
 *   @task:<rowId>                                 → 태스크 카드 link preview
 *   @doc:<docId>                                  → 문서 backlink
 *
 * 파서는 텍스트를 걸러 segment 배열로 반환.
 * 각 segment 는 plain text 또는 resolved reference.
 */

import type { Project, Sheet, Doc, CellValue } from '@/types';
import { computeSheetRows } from './formulaEngine';

export interface RefSegment {
  type: 'text' | 'sheet-cell' | 'sheet' | 'task' | 'doc' | 'broken';
  raw: string;
  resolvedValue?: CellValue;
  target?: {
    sheetId?: string;
    rowId?: string;
    columnId?: string;
    docId?: string;
  };
  label?: string;
}

const REF_PATTERN = /@(sheet|task|doc):([^\s.,;:!?)\]]+)/g;

export function parseReferences(
  text: string,
  project: Project | null | undefined,
): RefSegment[] {
  if (!text) return [{ type: 'text', raw: '' }];

  const segments: RefSegment[] = [];
  let lastIndex = 0;

  const matches = Array.from(text.matchAll(REF_PATTERN));

  for (const m of matches) {
    const index = m.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', raw: text.slice(lastIndex, index) });
    }
    const [raw, kind, rest] = m;
    segments.push(resolveReference(kind, rest, raw, project));
    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', raw: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', raw: text }];
}

function resolveReference(
  kind: string,
  rest: string,
  raw: string,
  project: Project | null | undefined,
): RefSegment {
  if (kind === 'sheet') return resolveSheetReference(rest, raw, project);

  if (kind === 'task') {
    if (!project) return { type: 'broken', raw, label: 'task 참조 — 프로젝트 없음' };
    for (const sheet of project.sheets) {
      const row = sheet.rows.find((r) => r.id === rest);
      if (row) {
        const titleCol = sheet.columns.find(
          (c) => c.name.toLowerCase() === 'title' || c.name.toLowerCase() === 'name' || c.type === 'general'
        );
        const label = titleCol ? String(row.cells[titleCol.id] ?? rest) : rest;
        return {
          type: 'task',
          raw,
          target: { sheetId: sheet.id, rowId: row.id },
          label,
        };
      }
    }
    return { type: 'broken', raw, label: `task not found: ${rest}` };
  }

  if (kind === 'doc') {
    const d = project?.docs?.find((x) => x.id === rest);
    if (!d) return { type: 'broken', raw, label: `doc not found: ${rest}` };
    return { type: 'doc', raw, target: { docId: d.id }, label: d.name };
  }

  return { type: 'broken', raw, label: raw };
}

function resolveSheetReference(
  rest: string,
  raw: string,
  project: Project | null | undefined,
): RefSegment {
  if (!project) return { type: 'broken', raw, label: '프로젝트 없음' };
  const parts = rest.split('/');
  const sheetName = parts[0];

  const sheet = project.sheets.find(
    (s) => s.name.toLowerCase() === sheetName.toLowerCase()
  );
  if (!sheet) return { type: 'broken', raw, label: `sheet not found: ${sheetName}` };

  if (parts.length === 1) {
    return {
      type: 'sheet',
      raw,
      target: { sheetId: sheet.id },
      label: sheet.name,
    };
  }

  const columnName = parts[1];
  const column = sheet.columns.find(
    (c) => c.name.toLowerCase() === columnName.toLowerCase()
  );
  if (!column) {
    return { type: 'broken', raw, label: `column not found: ${columnName}` };
  }

  const rowArg = parts[2];
  if (!rowArg) {
    return {
      type: 'sheet',
      raw,
      target: { sheetId: sheet.id, columnId: column.id },
      label: `${sheet.name}/${column.name}`,
    };
  }

  const rowIndex = parseInt(rowArg, 10);
  const row = !isNaN(rowIndex)
    ? sheet.rows[rowIndex - 1]
    : sheet.rows.find((r) => r.id === rowArg);

  if (!row) return { type: 'broken', raw, label: `row not found: ${rowArg}` };

  // 수식 컬럼 — 계산된 값 사용
  let resolvedValue: CellValue = row.cells[column.id] ?? null;
  const isFormula =
    column.type === 'formula' ||
    (typeof resolvedValue === 'string' && String(resolvedValue).startsWith('='));
  if (isFormula) {
    try {
      const computed = computeSheetRows(sheet, project.sheets);
      const cRow = computed[sheet.rows.indexOf(row)];
      if (cRow) resolvedValue = cRow[column.name] as CellValue;
    } catch {
      // fallback raw value
    }
  }

  return {
    type: 'sheet-cell',
    raw,
    resolvedValue,
    target: { sheetId: sheet.id, rowId: row.id, columnId: column.id },
    label: `${sheet.name}/${column.name}/${!isNaN(rowIndex) ? rowIndex : row.id.slice(0, 6)}`,
  };
}

/** 문서 backlink 수집 — 특정 docId 를 참조하는 다른 문서 찾기 */
export function findBacklinks(targetDocId: string, docs: Doc[]): Doc[] {
  const needle = `@doc:${targetDocId}`;
  return docs.filter((d) => d.id !== targetDocId && d.content.includes(needle));
}

/** 특정 셀을 참조하는 문서 찾기 */
export function findSheetCellBacklinks(
  project: Project,
  sheetId: string,
  columnId: string,
  rowId: string,
): Doc[] {
  const sheet = project.sheets.find((s) => s.id === sheetId);
  if (!sheet) return [];
  const column = sheet.columns.find((c) => c.id === columnId);
  if (!column) return [];
  const rowIndex = sheet.rows.findIndex((r) => r.id === rowId);
  if (rowIndex < 0) return [];

  const needles = [
    `@sheet:${sheet.name}/${column.name}/${rowIndex + 1}`,
    `@sheet:${sheet.name}/${column.name}/${rowId}`,
  ];

  return (project.docs ?? []).filter((d) =>
    needles.some((n) => d.content.includes(n))
  );
}

export type { Sheet };

/**
 * CSV export — pure frontend, no backend round-trip.
 *
 * Render a sheet's columns + rows into RFC 4180 CSV text and trigger
 * a browser download. Excel / Sheets / pandas all parse RFC 4180
 * cleanly, so this is the safest target.
 *
 * Quoting rules:
 *   - Fields containing comma, double-quote, CR, or LF are wrapped
 *     in double quotes, with embedded double-quotes doubled.
 *   - All other fields are emitted bare.
 *   - Line terminator is CRLF (RFC 4180 §2.1; Excel on Windows
 *     refuses LF-only).
 *   - UTF-8 BOM prepended so Excel on Windows decodes Korean /
 *     Japanese without the user picking an encoding.
 */

import type { Sheet, Row, Column, CellValue } from '@/types';

export function sheetToCsv(sheet: Sheet): string {
  const lines: string[] = [];
  // Header — column names. Falls back to the column id when name is
  // missing so the round-trip still maps.
  lines.push(sheet.columns.map((c) => quote(c.name || c.id)).join(','));
  for (const row of sheet.rows) {
    lines.push(sheet.columns.map((c) => quote(formatCell(row, c))).join(','));
  }
  // CRLF terminator + BOM. Excel won't decode UTF-8 without it.
  return '﻿' + lines.join('\r\n');
}

export function downloadSheetCsv(sheet: Sheet, filename?: string): void {
  const csv = sheetToCsv(sheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (filename ?? sheet.name ?? 'sheet')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .slice(0, 80);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Free the blob URL on the next tick — Safari sometimes needs the
  // anchor to actually fire before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatCell(row: Row, column: Column): string {
  const v = row.cells[column.id];
  return cellValueToString(v);
}

function cellValueToString(v: CellValue | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  // Object / array — defensive JSON. Live CellValue is string|number|
  // null but the backing JSONB occasionally holds richer shapes.
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function quote(s: string): string {
  if (s == null) return '';
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

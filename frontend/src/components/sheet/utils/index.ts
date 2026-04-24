import type { CellValue, Column, Sheet } from '@/types';

/**
 * link/lookup/rollup 해결에 필요한 컨텍스트.
 * 다른 시트의 행을 조회해야 하므로 sheets 배열 전달.
 */
export interface DisplayContext {
  sheets: Sheet[];
  currentSheet?: Sheet;
}

// 셀 키 생성 유틸리티 (Set 조회용)
export const cellKey = (rowId: string, columnId: string) => `${rowId}:${columnId}`;

// requestAnimationFrame 기반 throttle (브라우저 렌더링과 동기화)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T {
  let rafId: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastArgs: any[] | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    lastArgs = args;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (lastArgs) {
          fn(...lastArgs);
        }
      });
    }
  }) as T;
}

// 값 파싱 (숫자 변환 시도)
export function parseValue(value: string): CellValue {
  if (value.startsWith('=')) {
    return value; // 수식은 그대로 반환
  }
  const num = parseFloat(value);
  if (!isNaN(num) && value.trim() !== '') {
    return num;
  }
  return value;
}

// 표시값 포맷팅: column.type 에 따라 타입별 표시.
// link/lookup/rollup 은 DisplayContext (다른 시트 참조) 필요.
export function formatDisplayValue(
  value: CellValue,
  column?: Column,
  ctx?: DisplayContext,
  currentRow?: { id: string; cells: Record<string, CellValue> }
): string {
  if (value === null || value === undefined || value === '') {
    // link/lookup/rollup 은 value 가 비어있어도 관계 기반으로 계산
    if (column?.type === 'lookup' || column?.type === 'rollup') {
      return resolveLookupRollup(column, ctx, currentRow) ?? '';
    }
    return '';
  }

  switch (column?.type) {
    case 'checkbox': {
      const truthy = value === 'true' || value === 1 || value === '1';
      return truthy ? '☑' : '☐';
    }
    case 'date':
      return String(value);
    case 'url':
      return String(value);
    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      const fmt = column.currencyFormat ?? { symbol: '₩', decimals: 0 };
      return `${fmt.symbol}${num.toLocaleString(undefined, {
        minimumFractionDigits: fmt.decimals,
        maximumFractionDigits: fmt.decimals,
      })}`;
    }
    case 'rating': {
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(n)) return '';
      const max = column.ratingMax ?? 5;
      const filled = Math.min(max, Math.max(0, Math.round(n)));
      return '★'.repeat(filled) + '☆'.repeat(max - filled);
    }
    case 'select': {
      const opts = column.selectOptions ?? [];
      const match = opts.find((o) => o.id === value || o.label === value);
      return match?.label ?? String(value);
    }
    case 'multiSelect': {
      const opts = column.selectOptions ?? [];
      const ids =
        typeof value === 'string'
          ? value.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
      return ids
        .map((id) => opts.find((o) => o.id === id || o.label === id)?.label ?? id)
        .join(', ');
    }
    case 'link': {
      if (!ctx) return String(value);
      const target = ctx.sheets.find((s) => s.id === column.linkedSheetId);
      if (!target) return String(value);
      const displayCol = column.linkedDisplayColumnId;
      // 다중 참조면 CSV 로 저장된 rowId 들을 해석
      const ids = String(value).split(',').map((s) => s.trim()).filter(Boolean);
      const labels = ids.map((rowId) => {
        const row = target.rows.find((r) => r.id === rowId);
        if (!row) return rowId;
        if (!displayCol) return row.id;
        const cell = row.cells[displayCol];
        return cell === null || cell === undefined || cell === '' ? row.id : String(cell);
      });
      return labels.join(', ');
    }
    case 'lookup':
    case 'rollup':
      return resolveLookupRollup(column, ctx, currentRow) ?? String(value);
  }

  // 기본 (general/formula) — 숫자 포맷
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

// 셀에 값이 있는지 확인
export function hasValue(value: CellValue): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * lookup / rollup 해결.
 * 현재 row 의 link 컬럼 값 → 연결된 시트의 target 컬럼 값 → 집계.
 * 순환 참조는 현재 방어 X (MVP). lookup 체이닝 없음.
 */
function resolveLookupRollup(
  column: Column,
  ctx?: DisplayContext,
  currentRow?: { id: string; cells: Record<string, CellValue> }
): string | null {
  if (!ctx?.currentSheet || !currentRow || !column.lookupLinkColumnId) return null;

  const linkCol = ctx.currentSheet.columns.find((c) => c.id === column.lookupLinkColumnId);
  if (!linkCol || linkCol.type !== 'link') return null;

  const targetSheet = ctx.sheets.find((s) => s.id === linkCol.linkedSheetId);
  if (!targetSheet) return null;

  const linkValue = currentRow.cells[linkCol.id];
  if (!linkValue) return column.type === 'rollup' ? '0' : null;

  const rowIds = String(linkValue).split(',').map((s) => s.trim()).filter(Boolean);
  const linkedRows = rowIds
    .map((rid) => targetSheet.rows.find((r) => r.id === rid))
    .filter((r): r is NonNullable<typeof r> => !!r);

  if (column.type === 'lookup') {
    const vals = linkedRows.map((r) => r.cells[column.lookupTargetColumnId ?? ''] ?? '');
    return vals.filter((v) => v !== '').map(String).join(', ');
  }

  // rollup
  const nums = linkedRows
    .map((r) => r.cells[column.lookupTargetColumnId ?? ''])
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((n) => !isNaN(n));

  const agg = column.rollupAggregate ?? 'SUM';
  if (agg === 'COUNT') return String(linkedRows.length);
  if (agg === 'CONCAT') {
    return linkedRows
      .map((r) => r.cells[column.lookupTargetColumnId ?? ''])
      .filter((v) => v !== '' && v !== undefined && v !== null)
      .map(String)
      .join(', ');
  }
  if (nums.length === 0) return '0';
  switch (agg) {
    case 'SUM': return String(nums.reduce((s, n) => s + n, 0));
    case 'AVG': return (nums.reduce((s, n) => s + n, 0) / nums.length).toLocaleString(undefined, { maximumFractionDigits: 4 });
    case 'MIN': return String(Math.min(...nums));
    case 'MAX': return String(Math.max(...nums));
  }
  return '0';
}

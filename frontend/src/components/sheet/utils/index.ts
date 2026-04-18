import type { CellValue, Column } from '@/types';

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

// 표시값 포맷팅 — Track 1: column.type 에 따라 타입별 표시
export function formatDisplayValue(value: CellValue, column?: Column): string {
  if (value === null || value === undefined || value === '') return '';

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

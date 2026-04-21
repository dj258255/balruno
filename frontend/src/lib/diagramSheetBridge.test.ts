/**
 * Track 15-3 — Diagram ↔ Sheet bridge 테스트.
 */

import { describe, it, expect } from 'vitest';
import type { Sheet } from '@/types';
import { parseSheetRef, resolveNodeValue, formatSheetRef, extractRefs } from './diagramSheetBridge';

function makeSheet(): Sheet {
  return {
    id: 'sheet1',
    name: 'Economy',
    createdAt: 0,
    updatedAt: 0,
    columns: [
      { id: 'c-rate', name: 'rate', type: 'general', width: 100 },
      { id: 'c-prob', name: 'probability', type: 'general', width: 100 },
    ],
    rows: [
      { id: 'r1', cells: { 'c-rate': 10, 'c-prob': 0.7 } },
      { id: 'r2', cells: { 'c-rate': '25', 'c-prob': '0.3' } },
    ],
  };
}

describe('diagramSheetBridge', () => {
  it('parseSheetRef: valid/invalid', () => {
    expect(parseSheetRef('=sheet1!c-rate!r1')).toEqual({
      sheetId: 'sheet1',
      columnId: 'c-rate',
      rowId: 'r1',
    });
    expect(parseSheetRef('10')).toBeNull();
    expect(parseSheetRef('=sheet1!c-rate')).toBeNull();
    expect(parseSheetRef('=!c-rate!r1')).toBeNull();
    expect(parseSheetRef(123)).toBeNull();
    expect(parseSheetRef(null)).toBeNull();
  });

  it('resolveNodeValue: number pass-through', () => {
    expect(resolveNodeValue(42, [])).toBe(42);
    expect(resolveNodeValue(0.5, [])).toBe(0.5);
  });

  it('resolveNodeValue: string number 파싱', () => {
    expect(resolveNodeValue('10', [])).toBe(10);
    expect(resolveNodeValue('0.7', [])).toBe(0.7);
  });

  it('resolveNodeValue: sheet ref 해석 (숫자)', () => {
    const sheets = [makeSheet()];
    expect(resolveNodeValue('=sheet1!c-rate!r1', sheets)).toBe(10);
    expect(resolveNodeValue('=sheet1!c-prob!r1', sheets)).toBe(0.7);
  });

  it('resolveNodeValue: sheet ref 해석 (문자열 → number)', () => {
    const sheets = [makeSheet()];
    expect(resolveNodeValue('=sheet1!c-rate!r2', sheets)).toBe(25);
    expect(resolveNodeValue('=sheet1!c-prob!r2', sheets)).toBe(0.3);
  });

  it('resolveNodeValue: sheet name / column name 으로도 해석', () => {
    const sheets = [makeSheet()];
    expect(resolveNodeValue('=Economy!rate!r1', sheets)).toBe(10);
    expect(resolveNodeValue('=Economy!probability!r1', sheets)).toBe(0.7);
  });

  it('resolveNodeValue: 잘못된 ref → fallback', () => {
    const sheets = [makeSheet()];
    expect(resolveNodeValue('=unknown!x!y', sheets, 42)).toBe(42);
    expect(resolveNodeValue('=sheet1!unknown!r1', sheets, 42)).toBe(42);
    expect(resolveNodeValue('=sheet1!c-rate!rX', sheets, 42)).toBe(42);
  });

  it('formatSheetRef', () => {
    expect(formatSheetRef({ sheetId: 's1', columnId: 'c1', rowId: 'r1' })).toBe('=s1!c1!r1');
  });

  it('extractRefs: config 에서 참조 수집', () => {
    const refs = extractRefs({
      rate: '=sheet1!c-rate!r1',
      probability: 0.5,
      label: 'Source A',
      bonus: '=sheet1!c-prob!r2',
    });
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.key).sort()).toEqual(['bonus', 'rate']);
  });
});

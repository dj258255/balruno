/**
 * 시트 → UnitStats 매핑 휴리스틱 테스트.
 */

import { describe, it, expect } from 'vitest';
import { mapColumnsToUnitFields, rowToUnitStats, rowsToUnitStats, isUnitMappable } from './rowToUnits';
import type { Column, Row } from '../../types';

const col = (id: string, name: string, type: Column['type'] = 'general'): Column => ({
  id, name, type,
});

const row = (id: string, cells: Record<string, unknown>): Row => ({
  id,
  cells: cells as Record<string, never>,
});

describe('mapColumnsToUnitFields', () => {
  it('영문 표준 이름 매칭', () => {
    const cols = [col('c1', 'name'), col('c2', 'hp'), col('c3', 'atk'), col('c4', 'def'), col('c5', 'speed')];
    const map = mapColumnsToUnitFields(cols);
    expect(map.name).toBe('c1');
    expect(map.hp).toBe('c2');
    expect(map.atk).toBe('c3');
    expect(map.def).toBe('c4');
    expect(map.speed).toBe('c5');
  });

  it('한글 alias 매칭', () => {
    const cols = [col('c1', '이름'), col('c2', '체력'), col('c3', '공격력'), col('c4', '방어력'), col('c5', '공격속도')];
    const map = mapColumnsToUnitFields(cols);
    expect(map.name).toBe('c1');
    expect(map.hp).toBe('c2');
    expect(map.atk).toBe('c3');
    expect(map.def).toBe('c4');
    expect(map.speed).toBe('c5');
  });

  it('대소문자/공백/언더바 무시', () => {
    const cols = [col('c1', 'Max HP'), col('c2', 'CRIT_RATE'), col('c3', 'crit-damage')];
    const map = mapColumnsToUnitFields(cols);
    expect(map.maxHp).toBe('c1');
    expect(map.critRate).toBe('c2');
    expect(map.critDamage).toBe('c3');
  });

  it('첫 매치 우선 — 중복 alias 시 먼저 나온 컬럼', () => {
    const cols = [col('c1', 'attack'), col('c2', '공격')];
    const map = mapColumnsToUnitFields(cols);
    expect(map.atk).toBe('c1');
  });

  it('관련 없는 컬럼은 무시', () => {
    const cols = [col('c1', '메모'), col('c2', '담당자')];
    const map = mapColumnsToUnitFields(cols);
    expect(map.name).toBeUndefined();
    expect(map.hp).toBeUndefined();
  });
});

describe('isUnitMappable', () => {
  it('hp + atk 만 있어도 OK', () => {
    expect(isUnitMappable([col('c1', 'hp'), col('c2', 'atk')])).toBe(true);
  });

  it('maxHp + atk 도 OK (hp 만으로 fallback)', () => {
    expect(isUnitMappable([col('c1', 'maxHp'), col('c2', 'atk')])).toBe(true);
  });

  it('hp 만 있고 atk 없으면 false', () => {
    expect(isUnitMappable([col('c1', 'hp')])).toBe(false);
  });

  it('PM 시트 (status, assignee) 는 false', () => {
    expect(isUnitMappable([col('c1', 'status', 'select'), col('c2', 'assignee')])).toBe(false);
  });
});

describe('rowToUnitStats', () => {
  it('기본 매핑 + 누락 필드 default', () => {
    const cols = [col('c1', 'name'), col('c2', 'hp'), col('c3', 'atk')];
    const r = row('r1', { c1: '전사', c2: 200, c3: 30 });
    const unit = rowToUnitStats(r, cols);
    expect(unit.id).toBe('r1');
    expect(unit.name).toBe('전사');
    expect(unit.hp).toBe(200);
    expect(unit.maxHp).toBe(200); // hp 만 있으면 maxHp 도 같은 값
    expect(unit.atk).toBe(30);
    expect(unit.def).toBe(0);    // 컬럼 없으면 default
    expect(unit.speed).toBe(1);
  });

  it('maxHp 만 있으면 hp 도 maxHp 로', () => {
    const cols = [col('c1', '체력'), col('c2', 'atk')];
    const r = row('r1', { c1: 500, c2: 50 });
    const unit = rowToUnitStats(r, cols);
    expect(unit.hp).toBe(500);
    expect(unit.maxHp).toBe(500);
  });

  it('optional 필드는 매핑됐을 때만 채움', () => {
    const cols = [col('c1', 'hp'), col('c2', 'atk'), col('c3', 'critRate')];
    const r = row('r1', { c1: 100, c2: 10, c3: 0.3 });
    const unit = rowToUnitStats(r, cols);
    expect(unit.critRate).toBe(0.3);
    expect(unit.critDamage).toBeUndefined();
  });

  it('숫자 변환 실패 시 default', () => {
    const cols = [col('c1', 'hp'), col('c2', 'atk')];
    const r = row('r1', { c1: 'abc', c2: '20' });
    const unit = rowToUnitStats(r, cols);
    expect(unit.hp).toBe(100);  // hp default
    expect(unit.atk).toBe(20);  // 문자열 "20" 은 Number 로 OK
  });

  it('name 컬럼 없으면 row.id slice fallback', () => {
    const cols = [col('c1', 'hp'), col('c2', 'atk')];
    const r = row('row_abcdef12345', { c1: 100, c2: 10 });
    const unit = rowToUnitStats(r, cols);
    expect(unit.name).toContain('row_');
  });
});

describe('rowsToUnitStats', () => {
  it('여러 row 일괄 변환', () => {
    const cols = [col('c1', 'name'), col('c2', 'hp'), col('c3', 'atk')];
    const rows = [
      row('r1', { c1: 'A', c2: 100, c3: 10 }),
      row('r2', { c1: 'B', c2: 200, c3: 20 }),
    ];
    const units = rowsToUnitStats(rows, cols);
    expect(units.length).toBe(2);
    expect(units[0].name).toBe('A');
    expect(units[1].name).toBe('B');
    expect(units[1].atk).toBe(20);
  });
});

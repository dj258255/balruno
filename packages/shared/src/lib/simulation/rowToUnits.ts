/**
 * 시트 row → UnitStats 자동 매핑.
 *
 * 시트의 컬럼 이름을 영/한 alias 로 매칭해 UnitStats 의 표준 필드에 채워 넣음.
 * 누락 필드는 합리적 기본값. name 이 없으면 row.id slice 로 fallback.
 *
 * 사용처:
 *  - SheetTable RowContextMenu "이 행으로 시뮬 실행"
 *  - 다중 행 선택 → 팀 시뮬 자동 분배
 */

import type { Column, Row } from '../../types';
import type { UnitStats } from './types';

/** 컬럼 이름 → 표준 필드 매칭 (소문자 비교, 부분 일치 OK).
 *  MOBA/RPG/FPS 등 다양한 도메인 표기 흡수 — ad/ap/range 처럼 게임 장르별 약어도 포함. */
const FIELD_ALIASES: Record<keyof UnitStats, string[]> = {
  id:           [],
  name:         ['name', 'unit', 'character', 'champion', 'hero', 'class', '이름', '캐릭터', '유닛', '챔피언', '영웅', 'title'],
  hp:           ['hp', 'health', 'currenthp', 'life', '체력', '현재체력', '생명력'],
  maxHp:        ['maxhp', 'maxhealth', 'maxlife', '최대체력', '최대hp', '최대생명력'],
  atk:          ['atk', 'attack', 'attackpower', 'damage', 'dmg', 'power', 'ad', 'ap', '공격력', '공격', '데미지', '주문력'],
  def:          ['def', 'defense', 'defence', 'armor', 'mr', 'magicresist', '방어력', '방어', '마저', '마법저항'],
  speed:        ['speed', 'spd', 'attackspeed', 'atkspeed', 'as', 'movement', 'movespeed', 'ms', '속도', '공격속도', '공속', '이동속도'],
  critRate:     ['critrate', 'critchance', 'crit', '치확', '크리티컬확률', '치명타확률', '크리율'],
  critDamage:   ['critdamage', 'critdmg', 'critmult', '치피', '치명타데미지', '크리티컬배율', '크리피해'],
  accuracy:     ['accuracy', 'acc', 'hit', 'hitrate', '명중률', '명중'],
  evasion:      ['evasion', 'eva', 'dodge', 'dodgerate', 'agi', 'agility', '회피율', '회피', '민첩'],
  aimSkill:     ['aimskill', 'aim', '에임', '명중실력'],
  reactionSkill:['reactionskill', 'reaction', '반응속도', '반응실력'],
  decisionSkill:['decisionskill', 'decision', 'iq', '판단', '판단실력'],
  aiRules:      [],
};

const NUMERIC_FIELDS: Array<keyof UnitStats> = [
  'hp', 'maxHp', 'atk', 'def', 'speed',
  'critRate', 'critDamage', 'accuracy', 'evasion',
  'aimSkill', 'reactionSkill', 'decisionSkill',
];

/** 컬럼 이름 정규화 — 소문자 + 공백/언더바/하이픈 제거 */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[\s_\-/]/g, '');
}

/** 컬럼 배열에서 표준 필드명 → 매칭된 컬럼 id 매핑 만들기. */
export function mapColumnsToUnitFields(columns: Column[]): Partial<Record<keyof UnitStats, string>> {
  const result: Partial<Record<keyof UnitStats, string>> = {};
  for (const col of columns) {
    const norm = normalize(col.name);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.length === 0) continue;
      if (result[field as keyof UnitStats]) continue; // 첫 매치 우선
      if (aliases.some((alias) => normalize(alias) === norm)) {
        result[field as keyof UnitStats] = col.id;
        break;
      }
    }
  }
  return result;
}

/** unit-mappable 시트 판정 — 최소 hp + atk 컬럼이 있어야 의미 있음. */
export function isUnitMappable(columns: Column[]): boolean {
  const map = mapColumnsToUnitFields(columns);
  return Boolean(map.hp || map.maxHp) && Boolean(map.atk);
}

/** 한 row 를 UnitStats 로 변환. 누락 필드는 합리적 기본값. */
export function rowToUnitStats(
  row: Row,
  columns: Column[],
  fieldMap?: Partial<Record<keyof UnitStats, string>>,
): UnitStats {
  const map = fieldMap ?? mapColumnsToUnitFields(columns);
  const getNum = (field: keyof UnitStats, fallback: number): number => {
    const colId = map[field];
    if (!colId) return fallback;
    const v = row.cells[colId];
    if (v === null || v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const getStr = (field: keyof UnitStats, fallback: string): string => {
    const colId = map[field];
    if (!colId) return fallback;
    const v = row.cells[colId];
    return v === null || v === undefined || v === '' ? fallback : String(v);
  };

  // hp/maxHp: 둘 중 하나만 있으면 다른 쪽으로 복사
  const rawMax = map.maxHp ? getNum('maxHp', NaN) : NaN;
  const rawHp = map.hp ? getNum('hp', NaN) : NaN;
  const maxHp = Number.isFinite(rawMax) ? rawMax : Number.isFinite(rawHp) ? rawHp : 100;
  const hp = Number.isFinite(rawHp) ? rawHp : maxHp;

  const unit: UnitStats = {
    id: row.id,
    name: getStr('name', `Unit ${row.id.slice(0, 4)}`),
    hp,
    maxHp,
    atk: getNum('atk', 10),
    def: getNum('def', 0),
    speed: getNum('speed', 1),
  };

  // optional 필드 — 컬럼이 매핑됐을 때만 채움 (undefined 유지가 의미 있음)
  for (const field of NUMERIC_FIELDS) {
    if (field === 'hp' || field === 'maxHp' || field === 'atk' || field === 'def' || field === 'speed') continue;
    if (map[field]) {
      const v = getNum(field, NaN);
      if (Number.isFinite(v)) {
        (unit as unknown as Record<string, unknown>)[field] = v;
      }
    }
  }

  return unit;
}

/** 여러 row 를 UnitStats[] 로 변환. */
export function rowsToUnitStats(rows: Row[], columns: Column[]): UnitStats[] {
  const map = mapColumnsToUnitFields(columns);
  return rows.map((r) => rowToUnitStats(r, columns, map));
}

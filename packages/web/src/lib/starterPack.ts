/**
 * Starter Pack — 첫 진입 시 자동 시드 + 장르별 시작 팩.
 *
 * Notion / Airtable 식으로 빈 화면 대신 살아있는 데이터를 보여줌.
 * 첫 진입 시 사용자가 자기 게임 장르 골라 즉시 시작.
 *
 * 장르 카탈로그:
 *  - tutorial    — 캐릭터 + 스프린트 (기본)
 *  - rpg         — 캐릭터 스탯 + 무기 + EXP 곡선 + 가챠
 *  - fps         — 무기 시트 (DPS/사거리/반동) + TTK 표
 *  - moba        — 챔피언 (HP/AD/AP/MR) + 라인 매치업
 *  - rts         — 유닛 빌드 코스트 + 카운터 매트릭스
 *  - idle        — 업그레이드 비용 곡선 + 자원 흐름
 *  - roguelike   — 카드 덱 + 시너지
 *  - sprint      — 스프린트 백로그
 *  - bugTracker  — 버그 트래커
 *  - epicRoadmap — 에픽 로드맵
 *  - playtest    — 플레이테스트 세션
 *  - blank       — 빈 프로젝트
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Sparkles,
  Swords,
  Crosshair,
  Shield,
  Castle,
  Hourglass,
  SquareStack,
  ListTodo,
  Bug,
  Map as MapIcon,
  TestTube,
  FilePlus2,
  type LucideIcon,
} from 'lucide-react';
import type { Project, Sheet, Column, Row, Doc } from '@/types';

const now = () => Date.now();

function makeColumn(partial: Pick<Column, 'name' | 'type'> & Partial<Column>): Column {
  return { id: uuidv4(), width: 130, ...partial } as Column;
}
function makeRow(cells: Record<string, unknown>): Row {
  return { id: uuidv4(), cells: cells as Row['cells'] };
}
function selectCol(name: string, options: Array<{ id: string; label: string; color?: string }>): Column {
  return makeColumn({ name, type: 'select', selectOptions: options, width: 110 });
}

// =====================================================================
// 시트 builder 들 — 각 장르별 시트 한 묶음
// =====================================================================

function characterSheet(): Sheet {
  const c = {
    name: makeColumn({ name: '이름', type: 'general', width: 140 }),
    hp: makeColumn({ name: 'HP', type: 'general', width: 90 }),
    atk: makeColumn({ name: '공격력', type: 'general', width: 90 }),
    def: makeColumn({ name: '방어력', type: 'general', width: 90 }),
    speed: makeColumn({ name: '공격속도', type: 'general', width: 100 }),
    note: makeColumn({ name: '메모', type: 'general', width: 200 }),
  };
  return {
    id: uuidv4(),
    name: '캐릭터',
    columns: [c.name, c.hp, c.atk, c.def, c.speed, c.note],
    rows: [
      makeRow({ [c.name.id]: '전사', [c.hp.id]: 200, [c.atk.id]: 30, [c.def.id]: 20, [c.speed.id]: 1.0, [c.note.id]: '균형형 탱커' }),
      makeRow({ [c.name.id]: '도적', [c.hp.id]: 120, [c.atk.id]: 45, [c.def.id]: 8, [c.speed.id]: 1.6, [c.note.id]: '빠른 딜러' }),
      makeRow({ [c.name.id]: '마법사', [c.hp.id]: 100, [c.atk.id]: 50, [c.def.id]: 5, [c.speed.id]: 0.9, [c.note.id]: '유리대포' }),
      makeRow({ [c.name.id]: '성기사', [c.hp.id]: 220, [c.atk.id]: 25, [c.def.id]: 28, [c.speed.id]: 0.8, [c.note.id]: '최고 방어' }),
      makeRow({ [c.name.id]: '궁수', [c.hp.id]: 130, [c.atk.id]: 38, [c.def.id]: 10, [c.speed.id]: 1.3, [c.note.id]: '원거리 균형' }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function weaponSheet(): Sheet {
  const c = {
    name: makeColumn({ name: '무기', type: 'general', width: 140 }),
    type: selectCol('타입', [
      { id: 'sword', label: '검', color: '#3b82f6' },
      { id: 'bow', label: '활', color: '#10b981' },
      { id: 'staff', label: '지팡이', color: '#a855f7' },
      { id: 'gun', label: '총', color: '#ef4444' },
    ]),
    dmg: makeColumn({ name: '데미지', type: 'general', width: 90 }),
    range: makeColumn({ name: '사거리', type: 'general', width: 90 }),
    cd: makeColumn({ name: '쿨다운', type: 'general', width: 90 }),
    rarity: makeColumn({ name: '등급', type: 'rating', width: 100, ratingMax: 5 }),
  };
  return {
    id: uuidv4(),
    name: '무기',
    columns: [c.name, c.type, c.dmg, c.range, c.cd, c.rarity],
    rows: [
      makeRow({ [c.name.id]: '롱소드', [c.type.id]: 'sword', [c.dmg.id]: 35, [c.range.id]: 2, [c.cd.id]: 1.0, [c.rarity.id]: 2 }),
      makeRow({ [c.name.id]: '엘븐 보우', [c.type.id]: 'bow', [c.dmg.id]: 28, [c.range.id]: 12, [c.cd.id]: 1.2, [c.rarity.id]: 3 }),
      makeRow({ [c.name.id]: '아이스 스태프', [c.type.id]: 'staff', [c.dmg.id]: 50, [c.range.id]: 8, [c.cd.id]: 2.5, [c.rarity.id]: 4 }),
      makeRow({ [c.name.id]: '신성 검', [c.type.id]: 'sword', [c.dmg.id]: 60, [c.range.id]: 2, [c.cd.id]: 1.5, [c.rarity.id]: 5 }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function expCurveSheet(): Sheet {
  const c = {
    level: makeColumn({ name: '레벨', type: 'general', width: 70 }),
    expRequired: makeColumn({ name: '필요 EXP', type: 'general', width: 110 }),
    cumulative: makeColumn({ name: '누적 EXP', type: 'general', width: 110 }),
    reward: makeColumn({ name: '보상', type: 'general', width: 160 }),
  };
  const rows: Row[] = [];
  for (let lv = 1; lv <= 20; lv++) {
    const req = Math.floor(100 * Math.pow(1.15, lv - 1));
    const cum = Math.floor((100 * (Math.pow(1.15, lv) - 1)) / 0.15);
    rows.push(makeRow({
      [c.level.id]: lv,
      [c.expRequired.id]: req,
      [c.cumulative.id]: cum,
      [c.reward.id]: lv % 5 === 0 ? '스킬 포인트 + 1' : '',
    }));
  }
  return {
    id: uuidv4(), name: 'EXP 곡선',
    columns: [c.level, c.expRequired, c.cumulative, c.reward],
    rows, createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function gachaSheet(): Sheet {
  const c = {
    rarity: makeColumn({ name: '등급', type: 'general', width: 80 }),
    rate: makeColumn({ name: '확률 (%)', type: 'general', width: 100 }),
    pity: makeColumn({ name: '피티 (회)', type: 'general', width: 100 }),
    sample: makeColumn({ name: '대표 아이템', type: 'general', width: 160 }),
  };
  return {
    id: uuidv4(), name: '가챠 확률',
    columns: [c.rarity, c.rate, c.pity, c.sample],
    rows: [
      makeRow({ [c.rarity.id]: 'SSR', [c.rate.id]: 0.6, [c.pity.id]: 80, [c.sample.id]: '전설 무기' }),
      makeRow({ [c.rarity.id]: 'SR', [c.rate.id]: 5.1, [c.pity.id]: 10, [c.sample.id]: '에픽 무기' }),
      makeRow({ [c.rarity.id]: 'R', [c.rate.id]: 30, [c.pity.id]: 0, [c.sample.id]: '레어 재료' }),
      makeRow({ [c.rarity.id]: 'N', [c.rate.id]: 64.3, [c.pity.id]: 0, [c.sample.id]: '일반 재료' }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function fpsWeaponSheet(): Sheet {
  const c = {
    name: makeColumn({ name: '무기', type: 'general', width: 130 }),
    type: selectCol('카테고리', [
      { id: 'ar', label: 'AR', color: '#3b82f6' },
      { id: 'smg', label: 'SMG', color: '#10b981' },
      { id: 'sniper', label: '저격', color: '#a855f7' },
      { id: 'shotgun', label: '샷건', color: '#ef4444' },
    ]),
    dmg: makeColumn({ name: '데미지', type: 'general', width: 80 }),
    rpm: makeColumn({ name: '연사 (RPM)', type: 'general', width: 110 }),
    range: makeColumn({ name: '유효사거리(m)', type: 'general', width: 130 }),
    recoil: makeColumn({ name: '반동', type: 'rating', width: 100, ratingMax: 5 }),
    ttk: makeColumn({ name: 'TTK (ms)', type: 'general', width: 100 }),
  };
  return {
    id: uuidv4(), name: 'FPS 무기',
    columns: [c.name, c.type, c.dmg, c.rpm, c.range, c.recoil, c.ttk],
    rows: [
      makeRow({ [c.name.id]: 'M4A1', [c.type.id]: 'ar', [c.dmg.id]: 30, [c.rpm.id]: 700, [c.range.id]: 50, [c.recoil.id]: 2, [c.ttk.id]: 257 }),
      makeRow({ [c.name.id]: 'MP5', [c.type.id]: 'smg', [c.dmg.id]: 22, [c.rpm.id]: 800, [c.range.id]: 25, [c.recoil.id]: 1, [c.ttk.id]: 300 }),
      makeRow({ [c.name.id]: 'AWP', [c.type.id]: 'sniper', [c.dmg.id]: 115, [c.rpm.id]: 41, [c.range.id]: 100, [c.recoil.id]: 5, [c.ttk.id]: 0 }),
      makeRow({ [c.name.id]: 'SPAS-12', [c.type.id]: 'shotgun', [c.dmg.id]: 80, [c.rpm.id]: 60, [c.range.id]: 8, [c.recoil.id]: 4, [c.ttk.id]: 1000 }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function mobaChampionSheet(): Sheet {
  const c = {
    name: makeColumn({ name: '챔피언', type: 'general', width: 130 }),
    role: selectCol('포지션', [
      { id: 'top', label: '탑', color: '#dc2626' },
      { id: 'jungle', label: '정글', color: '#16a34a' },
      { id: 'mid', label: '미드', color: '#7c3aed' },
      { id: 'adc', label: '원딜', color: '#ea580c' },
      { id: 'sup', label: '서포터', color: '#0ea5e9' },
    ]),
    hp: makeColumn({ name: 'HP', type: 'general', width: 80 }),
    ad: makeColumn({ name: 'AD', type: 'general', width: 70 }),
    ap: makeColumn({ name: 'AP', type: 'general', width: 70 }),
    armor: makeColumn({ name: '방어', type: 'general', width: 70 }),
    mr: makeColumn({ name: 'MR', type: 'general', width: 70 }),
    diff: makeColumn({ name: '난이도', type: 'rating', width: 100, ratingMax: 5 }),
  };
  return {
    id: uuidv4(), name: '챔피언',
    columns: [c.name, c.role, c.hp, c.ad, c.ap, c.armor, c.mr, c.diff],
    rows: [
      makeRow({ [c.name.id]: 'Garen', [c.role.id]: 'top', [c.hp.id]: 690, [c.ad.id]: 66, [c.ap.id]: 0, [c.armor.id]: 36, [c.mr.id]: 32, [c.diff.id]: 1 }),
      makeRow({ [c.name.id]: 'Lee Sin', [c.role.id]: 'jungle', [c.hp.id]: 600, [c.ad.id]: 70, [c.ap.id]: 0, [c.armor.id]: 33, [c.mr.id]: 32, [c.diff.id]: 4 }),
      makeRow({ [c.name.id]: 'Yasuo', [c.role.id]: 'mid', [c.hp.id]: 590, [c.ad.id]: 60, [c.ap.id]: 0, [c.armor.id]: 30, [c.mr.id]: 32, [c.diff.id]: 5 }),
      makeRow({ [c.name.id]: 'Ahri', [c.role.id]: 'mid', [c.hp.id]: 526, [c.ad.id]: 53, [c.ap.id]: 0, [c.armor.id]: 21, [c.mr.id]: 30, [c.diff.id]: 3 }),
      makeRow({ [c.name.id]: 'Thresh', [c.role.id]: 'sup', [c.hp.id]: 580, [c.ad.id]: 56, [c.ap.id]: 0, [c.armor.id]: 32, [c.mr.id]: 30, [c.diff.id]: 4 }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function rtsUnitSheet(): Sheet {
  const c = {
    name: makeColumn({ name: '유닛', type: 'general', width: 120 }),
    food: makeColumn({ name: '식량', type: 'general', width: 80 }),
    gold: makeColumn({ name: '골드', type: 'general', width: 80 }),
    buildTime: makeColumn({ name: '생산 (s)', type: 'general', width: 100 }),
    hp: makeColumn({ name: 'HP', type: 'general', width: 80 }),
    dmg: makeColumn({ name: '데미지', type: 'general', width: 80 }),
    counter: makeColumn({ name: '카운터', type: 'general', width: 130 }),
  };
  return {
    id: uuidv4(), name: 'RTS 유닛',
    columns: [c.name, c.food, c.gold, c.buildTime, c.hp, c.dmg, c.counter],
    rows: [
      makeRow({ [c.name.id]: '보병', [c.food.id]: 50, [c.gold.id]: 0, [c.buildTime.id]: 17, [c.hp.id]: 60, [c.dmg.id]: 8, [c.counter.id]: '기병' }),
      makeRow({ [c.name.id]: '궁수', [c.food.id]: 40, [c.gold.id]: 30, [c.buildTime.id]: 23, [c.hp.id]: 35, [c.dmg.id]: 10, [c.counter.id]: '보병' }),
      makeRow({ [c.name.id]: '기병', [c.food.id]: 80, [c.gold.id]: 0, [c.buildTime.id]: 30, [c.hp.id]: 100, [c.dmg.id]: 9, [c.counter.id]: '궁수' }),
      makeRow({ [c.name.id]: '공성탑', [c.food.id]: 0, [c.gold.id]: 200, [c.buildTime.id]: 50, [c.hp.id]: 200, [c.dmg.id]: 30, [c.counter.id]: '근접' }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function idleUpgradeSheet(): Sheet {
  const c = {
    level: makeColumn({ name: '레벨', type: 'general', width: 70 }),
    cost: makeColumn({ name: '비용', type: 'general', width: 110 }),
    income: makeColumn({ name: '초당 수익', type: 'general', width: 110 }),
    paybackSec: makeColumn({ name: '회수 시간(s)', type: 'general', width: 130 }),
  };
  const rows: Row[] = [];
  for (let lv = 1; lv <= 15; lv++) {
    const cost = Math.floor(100 * Math.pow(1.5, lv - 1));
    const income = Math.floor(2 * Math.pow(1.3, lv - 1));
    rows.push(makeRow({
      [c.level.id]: lv,
      [c.cost.id]: cost,
      [c.income.id]: income,
      [c.paybackSec.id]: Math.floor(cost / income),
    }));
  }
  return {
    id: uuidv4(), name: 'Idle 업그레이드',
    columns: [c.level, c.cost, c.income, c.paybackSec],
    rows, createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function roguelikeDeckSheet(): Sheet {
  const c = {
    card: makeColumn({ name: '카드', type: 'general', width: 130 }),
    type: selectCol('타입', [
      { id: 'attack', label: '공격', color: '#ef4444' },
      { id: 'skill', label: '스킬', color: '#3b82f6' },
      { id: 'power', label: '파워', color: '#a855f7' },
    ]),
    cost: makeColumn({ name: '에너지', type: 'general', width: 90 }),
    effect: makeColumn({ name: '효과', type: 'general', width: 200 }),
    rarity: selectCol('희귀도', [
      { id: 'starter', label: '시작', color: '#94a3b8' },
      { id: 'common', label: '커먼', color: '#64748b' },
      { id: 'uncommon', label: '언커먼', color: '#3b82f6' },
      { id: 'rare', label: '레어', color: '#f59e0b' },
    ]),
  };
  return {
    id: uuidv4(), name: '카드 덱',
    columns: [c.card, c.type, c.cost, c.effect, c.rarity],
    rows: [
      makeRow({ [c.card.id]: 'Strike', [c.type.id]: 'attack', [c.cost.id]: 1, [c.effect.id]: '6 데미지', [c.rarity.id]: 'starter' }),
      makeRow({ [c.card.id]: 'Defend', [c.type.id]: 'skill', [c.cost.id]: 1, [c.effect.id]: '5 방어', [c.rarity.id]: 'starter' }),
      makeRow({ [c.card.id]: 'Bash', [c.type.id]: 'attack', [c.cost.id]: 2, [c.effect.id]: '8 데미지 + 취약 2', [c.rarity.id]: 'starter' }),
      makeRow({ [c.card.id]: 'Cleave', [c.type.id]: 'attack', [c.cost.id]: 1, [c.effect.id]: '8 광역 데미지', [c.rarity.id]: 'common' }),
      makeRow({ [c.card.id]: 'Inflame', [c.type.id]: 'power', [c.cost.id]: 1, [c.effect.id]: '근력 + 2', [c.rarity.id]: 'uncommon' }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'game-data',
  };
}

function sprintBacklogSheet(): Sheet {
  const c = {
    title: makeColumn({ name: '제목', type: 'general', width: 220 }),
    status: selectCol('Status', [
      { id: 'todo', label: 'Todo', color: '#94a3b8' },
      { id: 'doing', label: 'Doing', color: '#3b82f6' },
      { id: 'done', label: 'Done', color: '#10b981' },
    ]),
    priority: selectCol('우선순위', [
      { id: 'p0', label: 'P0', color: '#dc2626' },
      { id: 'p1', label: 'P1', color: '#f59e0b' },
      { id: 'p2', label: 'P2', color: '#94a3b8' },
    ]),
    effort: makeColumn({ name: 'Effort', type: 'rating', width: 90, ratingMax: 5 }),
    type: selectCol('Type', [
      { id: 'feature', label: 'Feature', color: '#3b82f6' },
      { id: 'bug', label: 'Bug', color: '#ef4444' },
      { id: 'chore', label: 'Chore', color: '#94a3b8' },
      { id: 'design', label: 'Design', color: '#a855f7' },
    ]),
    assignee: makeColumn({ name: '담당', type: 'general', width: 100 }),
    due: makeColumn({ name: '마감', type: 'date', width: 120 }),
  };
  return {
    id: uuidv4(), name: '스프린트',
    columns: [c.title, c.status, c.priority, c.effort, c.type, c.assignee, c.due],
    rows: [
      makeRow({ [c.title.id]: '캐릭터 1차 밸런스', [c.status.id]: 'doing', [c.priority.id]: 'p0', [c.effort.id]: 5, [c.type.id]: 'design', [c.assignee.id]: '나' }),
      makeRow({ [c.title.id]: '신규 무기 데이터', [c.status.id]: 'todo', [c.priority.id]: 'p1', [c.effort.id]: 3, [c.type.id]: 'feature', [c.assignee.id]: '나' }),
      makeRow({ [c.title.id]: '인플레이션 검토', [c.status.id]: 'todo', [c.priority.id]: 'p1', [c.effort.id]: 2, [c.type.id]: 'design', [c.assignee.id]: '나' }),
      makeRow({ [c.title.id]: '튜토리얼 텍스트', [c.status.id]: 'done', [c.priority.id]: 'p2', [c.effort.id]: 1, [c.type.id]: 'chore', [c.assignee.id]: '나' }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'pm',
  };
}

function bugTrackerSheet(): Sheet {
  const c = {
    title: makeColumn({ name: '버그', type: 'general', width: 240 }),
    severity: selectCol('심각도', [
      { id: 'critical', label: 'Critical', color: '#dc2626' },
      { id: 'major', label: 'Major', color: '#f59e0b' },
      { id: 'minor', label: 'Minor', color: '#94a3b8' },
    ]),
    priority: selectCol('우선순위', [
      { id: 'p0', label: 'P0', color: '#dc2626' },
      { id: 'p1', label: 'P1', color: '#f59e0b' },
      { id: 'p2', label: 'P2', color: '#94a3b8' },
    ]),
    status: selectCol('Status', [
      { id: 'open', label: 'Open', color: '#ef4444' },
      { id: 'fixing', label: 'Fixing', color: '#f59e0b' },
      { id: 'fixed', label: 'Fixed', color: '#10b981' },
    ]),
    description: makeColumn({ name: '설명', type: 'general', width: 240 }),
    repro: makeColumn({ name: '재현 단계', type: 'general', width: 220 }),
    screenshot: makeColumn({ name: '스크린샷', type: 'url', width: 130 }),
    reporter: makeColumn({ name: '보고자', type: 'general', width: 100 }),
    assignee: makeColumn({ name: '담당', type: 'general', width: 100 }),
    submittedAt: makeColumn({ name: '등록일', type: 'date', width: 120 }),
  };
  return {
    id: uuidv4(), name: '버그 트래커',
    columns: [c.title, c.severity, c.priority, c.status, c.description, c.repro, c.screenshot, c.reporter, c.assignee, c.submittedAt],
    rows: [
      makeRow({
        [c.title.id]: '도적 크리율 100% 시 데미지 이상',
        [c.severity.id]: 'major',
        [c.priority.id]: 'p1',
        [c.status.id]: 'open',
        [c.description.id]: '도적 크리율을 100%로 설정하면 일반 공격에 critDamage 배율이 적용되지 않음',
        [c.repro.id]: '1) 도적 선택 2) critRate=1, critDamage=2 설정 3) 일반 공격 시 데미지 = base * 1 (예상: base * 2)',
        [c.reporter.id]: 'QA1',
        [c.assignee.id]: '나',
      }),
      makeRow({
        [c.title.id]: '경제 시뮬 9999일 시 NaN',
        [c.severity.id]: 'minor',
        [c.priority.id]: 'p2',
        [c.status.id]: 'fixing',
        [c.description.id]: '시뮬레이션 일수가 10000을 넘으면 supplyOverTime 차트에 NaN 값 표시',
        [c.repro.id]: '경제 설계 → 시뮬 일수 10000 입력 → 차트 보면 후반부 NaN',
        [c.reporter.id]: '나',
        [c.assignee.id]: '나',
      }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'pm',
  };
}

function epicRoadmapSheet(): Sheet {
  const c = {
    epic: makeColumn({ name: '에픽', type: 'general', width: 220 }),
    quarter: selectCol('분기', [
      { id: 'q1', label: 'Q1', color: '#3b82f6' },
      { id: 'q2', label: 'Q2', color: '#10b981' },
      { id: 'q3', label: 'Q3', color: '#f59e0b' },
      { id: 'q4', label: 'Q4', color: '#a855f7' },
    ]),
    status: selectCol('Status', [
      { id: 'planning', label: 'Planning', color: '#94a3b8' },
      { id: 'building', label: 'Building', color: '#3b82f6' },
      { id: 'shipped', label: 'Shipped', color: '#10b981' },
    ]),
    startDate: makeColumn({ name: '시작일', type: 'date', width: 120 }),
    endDate: makeColumn({ name: '종료일', type: 'date', width: 120 }),
    progress: makeColumn({ name: '진행률 %', type: 'general', width: 100 }),
    owner: makeColumn({ name: '주도', type: 'general', width: 100 }),
    impact: makeColumn({ name: '임팩트', type: 'rating', width: 100, ratingMax: 5 }),
  };
  return {
    id: uuidv4(), name: '에픽 로드맵',
    columns: [c.epic, c.quarter, c.status, c.startDate, c.endDate, c.progress, c.owner, c.impact],
    rows: [
      makeRow({ [c.epic.id]: '경제 시스템 v2', [c.quarter.id]: 'q2', [c.status.id]: 'building', [c.startDate.id]: '2026-04-01', [c.endDate.id]: '2026-06-30', [c.progress.id]: 45, [c.owner.id]: '나', [c.impact.id]: 5 }),
      makeRow({ [c.epic.id]: '신규 챔피언 5종', [c.quarter.id]: 'q3', [c.status.id]: 'planning', [c.startDate.id]: '2026-07-01', [c.endDate.id]: '2026-09-30', [c.progress.id]: 0, [c.owner.id]: '나', [c.impact.id]: 4 }),
      makeRow({ [c.epic.id]: '튜토리얼 개편', [c.quarter.id]: 'q1', [c.status.id]: 'shipped', [c.startDate.id]: '2026-01-15', [c.endDate.id]: '2026-03-15', [c.progress.id]: 100, [c.owner.id]: '나', [c.impact.id]: 3 }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'pm',
  };
}

function playtestSheet(): Sheet {
  const c = {
    session: makeColumn({ name: '세션', type: 'general', width: 200 }),
    date: makeColumn({ name: '일자', type: 'date', width: 120 }),
    version: makeColumn({ name: '빌드 버전', type: 'general', width: 100 }),
    tester: makeColumn({ name: '테스터', type: 'general', width: 100 }),
    facilitator: makeColumn({ name: '진행자', type: 'general', width: 100 }),
    rating: makeColumn({ name: '재미도', type: 'rating', width: 100, ratingMax: 10 }),
    pros: makeColumn({ name: 'Pros (좋은 점)', type: 'general', width: 240 }),
    cons: makeColumn({ name: 'Cons (안 좋은 점)', type: 'general', width: 240 }),
    actionTaken: selectCol('조치', [
      { id: 'pending', label: '검토 중', color: '#94a3b8' },
      { id: 'inprogress', label: '반영 중', color: '#3b82f6' },
      { id: 'done', label: '반영 완료', color: '#10b981' },
      { id: 'wontfix', label: '미반영', color: '#71717a' },
    ]),
  };
  return {
    id: uuidv4(), name: '플레이테스트',
    columns: [c.session, c.date, c.version, c.tester, c.facilitator, c.rating, c.pros, c.cons, c.actionTaken],
    rows: [
      makeRow({
        [c.session.id]: '1차 클로즈드 베타',
        [c.version.id]: 'v0.3.0',
        [c.tester.id]: '내부 5명',
        [c.facilitator.id]: '나',
        [c.rating.id]: 7,
        [c.pros.id]: '핵심 루프 재미있음. 캐릭터 디자인 호평.',
        [c.cons.id]: '튜토리얼 너무 김 (15분+). 보스 1번이 너무 어려움.',
        [c.actionTaken.id]: 'inprogress',
      }),
      makeRow({
        [c.session.id]: '2차 친구 5명',
        [c.version.id]: 'v0.4.1',
        [c.tester.id]: '외부',
        [c.facilitator.id]: '나',
        [c.rating.id]: 8,
        [c.pros.id]: '튜토리얼 짧아져서 진입 부드러움.',
        [c.cons.id]: '경제 후반 인플레. 가챠 박애심 (소프트 피티) 부족.',
        [c.actionTaken.id]: 'pending',
      }),
    ],
    createdAt: now(), updatedAt: now(), kind: 'pm',
  };
}

// =====================================================================
// Welcome doc 빌더 — 장르별 커스텀 가이드
// =====================================================================

function welcomeDoc(genreLabel: string, sheetNames: string[], extraTip?: string): Doc {
  const tips = sheetNames.map((n) => `<li><strong>${n}</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li>`).join('');
  const extra = extraTip ? `<p>${extraTip}</p>` : '';
  return {
    id: uuidv4(),
    name: 'Welcome',
    content: `<h1>${genreLabel} 시작 팩</h1>
<p>${genreLabel} 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>
<h2>이 워크스페이스에 든 것</h2>
<ul>${tips}</ul>
<h2>30초 안에 해 볼 것</h2>
<ol>
<li>아무 셀이나 <strong>클릭</strong> → 값 편집</li>
<li>셀에 <code>=</code> → 함수 자동완성 popover</li>
<li>일반 셀에 <code>/</code> → <code>/today</code> <code>/uuid</code> 같은 빠른 명령</li>
<li>행 우클릭 → "이 행으로 시뮬 실행" (hp/atk 컬럼이 있으면)</li>
<li><code>?</code> 키 → 단축키, <code>⌘K</code> → 모든 검색</li>
</ol>
${extra}
<p>오른쪽 우하단 코치마크 카드에서 단계별 가이드도 보실 수 있어요.</p>`,
    createdAt: now(),
    updatedAt: now(),
  };
}

// =====================================================================
// Starter Catalog — 12개 장르
// =====================================================================

export interface CoachmarkStep {
  title: string;
  body: string;
  /** 사용자가 시도해 볼 한 줄 행동 — 코치마크 카드 하단 강조 */
  action: string;
}

export interface StarterEntry {
  id: string;
  /** i18n key root — `starterPack.{i18nKey}.label/description/stepNTitle…` */
  i18nKey: string;
  icon: LucideIcon;
  /** lucide 아이콘 색 강조 — 카테고리별 시각 구분 */
  color: string;
  build: () => Project;
  /** 코치마크 단계 수 (1..N → starterPack.{i18nKey}.stepNTitle/Body/Action 키로 해석) */
  stepCount: number;
  /** 단계 번호별 i18n 의 root — entry 자체와 다를 수 있어 (ex: COMMON_STEPS 공유) 별도 지정. 기본 i18nKey. */
  stepsI18nKey?: string;
}

/** 모든 장르 공통 default 단계 — 일부 장르가 자체 단계 안 정의 시 fallback. starterPack.common.* 키 5단계. */
export const COMMON_STEPS_KEY = 'common';
export const COMMON_STEPS_COUNT = 5;

/**
 * 코치마크 1단계 정보 — i18n 키 root + 단계 인덱스로 t() 호출에 필요한 정보 반환.
 * StarterCoachmark 가 useTranslations('starterPack') 으로 받아서 호출.
 */
export function getStepKeys(stepsRoot: string, index: number): { titleKey: string; bodyKey: string; actionKey: string } {
  const n = index + 1;
  return {
    titleKey: `${stepsRoot}.step${n}Title`,
    bodyKey: `${stepsRoot}.step${n}Body`,
    actionKey: `${stepsRoot}.step${n}Action`,
  };
}

export const STARTER_CATALOG: StarterEntry[] = [
  {
    id: 'tutorial',
    i18nKey: 'tutorial',
    icon: Sparkles,
    color: '#8b5cf6',
    build: () => buildProject('튜토리얼', '시작용 예시 — 자유롭게 편집/삭제하세요',
      [characterSheet(), sprintBacklogSheet()],
      welcomeDoc('튜토리얼', ['캐릭터', '스프린트']),
      'tutorial'),
    stepCount: COMMON_STEPS_COUNT,
    stepsI18nKey: COMMON_STEPS_KEY,
  },
  {
    id: 'rpg',
    i18nKey: 'rpg',
    icon: Swords,
    color: '#dc2626',
    build: () => buildProject('RPG 프로젝트', 'RPG 밸런싱 시작 팩',
      [characterSheet(), weaponSheet(), expCurveSheet(), gachaSheet()],
      welcomeDoc('RPG', ['캐릭터', '무기', 'EXP 곡선', '가챠 확률'],
        'EXP 곡선의 base/rate 만 바꾸면 1-20렙 자동 재계산. 무기는 등급(별점)으로 정렬해 보세요.'),
      'rpg'),
    stepCount: 5,
  },
  {
    id: 'fps',
    i18nKey: 'fps',
    icon: Crosshair,
    color: '#ea580c',
    build: () => buildProject('FPS 프로젝트', 'FPS 슈터 밸런싱',
      [fpsWeaponSheet()],
      welcomeDoc('FPS 슈터', ['FPS 무기'],
        'TTK = 1000 / (DPS / target_hp). 카테고리별 평균 TTK 가 비슷해야 균형. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.'),
      'fps'),
    stepCount: 5,
  },
  {
    id: 'moba',
    i18nKey: 'moba',
    icon: Shield,
    color: '#0ea5e9',
    build: () => buildProject('MOBA 프로젝트', 'MOBA 챔피언 밸런싱',
      [mobaChampionSheet()],
      welcomeDoc('MOBA', ['챔피언'],
        '난이도 별점은 1=쉬움 5=어려움. 같은 포지션 끼리 ad/ap/hp 평균 비교. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.'),
      'moba'),
    stepCount: 5,
  },
  {
    id: 'rts',
    i18nKey: 'rts',
    icon: Castle,
    color: '#16a34a',
    build: () => buildProject('RTS 프로젝트', 'RTS 유닛 밸런싱',
      [rtsUnitSheet()],
      welcomeDoc('RTS', ['RTS 유닛'],
        '카운터 컬럼은 가위바위보. 보병 → 기병 → 궁수 → 보병 같은 순환이 핵심. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.'),
      'rts'),
    stepCount: 5,
  },
  {
    id: 'idle',
    i18nKey: 'idle',
    icon: Hourglass,
    color: '#f59e0b',
    build: () => buildProject('Idle 프로젝트', 'Idle 클리커 밸런싱',
      [idleUpgradeSheet()],
      welcomeDoc('Idle 클리커', ['Idle 업그레이드'],
        '회수 시간(s) 가 일정하게 늘어야 진행 곡선 부드러움. 비용 1.5배수 / 수익 1.3배수 가 기본. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.'),
      'idle'),
    stepCount: 5,
  },
  {
    id: 'roguelike',
    i18nKey: 'roguelike',
    icon: SquareStack,
    color: '#7c3aed',
    build: () => buildProject('덱빌더 프로젝트', '로그라이크 덱빌더 밸런싱',
      [roguelikeDeckSheet()],
      welcomeDoc('로그라이크 덱빌더', ['카드 덱'],
        '희귀도별 평균 데미지/방어 비율 점검. starter 카드는 약하지만 시너지 기반. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.'),
      'roguelike'),
    stepCount: 5,
  },
  {
    id: 'sprint',
    i18nKey: 'sprint',
    icon: ListTodo,
    color: '#3b82f6',
    build: () => buildProject('스프린트 보드', 'PM 작업 관리',
      [sprintBacklogSheet()],
      welcomeDoc('스프린트 보드', ['스프린트'],
        '칸반 뷰 (단축키 K) 로 status 별 카드. 다른 status 로 drag.'),
      'sprint'),
    stepCount: 5,
  },
  {
    id: 'bug',
    i18nKey: 'bug',
    icon: Bug,
    color: '#ef4444',
    build: () => buildProject('버그 트래커', '버그 관리',
      [bugTrackerSheet()],
      welcomeDoc('버그 트래커', ['버그 트래커']),
      'bug'),
    stepCount: 5,
  },
  {
    id: 'roadmap',
    i18nKey: 'roadmap',
    icon: MapIcon,
    color: '#10b981',
    build: () => buildProject('로드맵', '에픽 로드맵',
      [epicRoadmapSheet()],
      welcomeDoc('에픽 로드맵', ['에픽 로드맵'],
        '간트 뷰 (단축키 T) 로 분기별 일정 시각화.'),
      'roadmap'),
    stepCount: 5,
  },
  {
    id: 'playtest',
    i18nKey: 'playtest',
    icon: TestTube,
    color: '#06b6d4',
    build: () => buildProject('플레이테스트', '플레이테스트 세션 기록',
      [playtestSheet()],
      welcomeDoc('플레이테스트', ['플레이테스트'],
        '재미도 별점 평균 + 핵심 피드백 텍스트로 회고.'),
      'playtest'),
    stepCount: 5,
  },
  {
    id: 'blank',
    i18nKey: 'blank',
    icon: FilePlus2,
    color: '#94a3b8',
    build: () => buildProject('새 프로젝트', '', [], undefined, 'blank'),
    stepCount: COMMON_STEPS_COUNT,
    stepsI18nKey: COMMON_STEPS_KEY,
  },
];

function buildProject(name: string, description: string, sheets: Sheet[], doc?: Doc, starterId?: string): Project {
  return {
    id: uuidv4(),
    name,
    description,
    createdAt: now(),
    updatedAt: now(),
    sheets,
    docs: doc ? [doc] : [],
    starterId,
  };
}

/** 기본 starter — backward-compat 용 (createProject 의 seedStarter 옵션). */
export function buildStarterProject(name = '튜토리얼'): Project {
  const tutorial = STARTER_CATALOG.find((s) => s.id === 'tutorial')!;
  const project = tutorial.build();
  return { ...project, name };
}

/** id 로 starter 가져오기. */
export function buildStarterById(id: string): Project | null {
  const entry = STARTER_CATALOG.find((s) => s.id === id);
  return entry ? entry.build() : null;
}

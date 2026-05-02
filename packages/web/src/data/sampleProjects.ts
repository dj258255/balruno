import { v4 as uuidv4 } from 'uuid';
import type { Project } from '@/types';
import { GENRE_SAMPLES } from './genreSamples';

// 샘플 프로젝트 카테고리 — 밸런싱 + 팀 PM
export type SampleCategory =
  | 'combat'
  | 'economy'
  | 'progression'
  | 'gacha'
  | 'team-pm'; // (Codecks meets Airtable)

// 샘플 프로젝트 메타데이터
export interface SampleProjectMeta {
  id: string;
  nameKey: string;        // i18n 키
  descriptionKey: string; // i18n 키
  icon: string;           // lucide 아이콘명
  category: SampleCategory;
}

// 번역 함수 타입
type TranslateFunction = (key: string) => string;

// 샘플 프로젝트 (메타 + 데이터)
export interface SampleProject extends SampleProjectMeta {
  createProject: (t: TranslateFunction) => Project;  // 프로젝트 생성 함수 (번역 함수 전달)
}

// 유틸: 고유 ID 생성 — uuid v4 사용 (이전 9자 랜덤은 collision 가능성이 있었음)
const generateId = () => uuidv4();

// ============================================
// 1. RPG 캐릭터 스탯 샘플
// ============================================
const createRPGCharacterProject = (t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  // 수식 정의
  const damageFormula = '=ATK*(1-DEF/200)';
  const dpsFormula = '=ATK*SPD';
  const ehpFormula = '=HP*(1+DEF/100)';

  return {
    id: generateId(),
    name: '', // i18n에서 설정
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'Characters',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'col1', name: 'Class', type: 'general', width: 100 },
          { id: 'col2', name: 'HP', type: 'general', width: 80 },
          { id: 'col3', name: 'ATK', type: 'general', width: 80 },
          { id: 'col4', name: 'DEF', type: 'general', width: 80 },
          { id: 'col5', name: 'SPD', type: 'general', width: 80 },
          { id: 'col6', name: 'Damage', type: 'formula', width: 100, formula: damageFormula },
          { id: 'col7', name: 'DPS', type: 'formula', width: 100, formula: dpsFormula },
          { id: 'col8', name: 'EHP', type: 'formula', width: 100, formula: ehpFormula },
        ],
        rows: [
          {
            id: 'row1',
            cells: { col1: 'Warrior', col2: 1200, col3: 85, col4: 60, col5: 0.8, col6: damageFormula, col7: dpsFormula, col8: ehpFormula },
          },
          {
            id: 'row2',
            cells: { col1: 'Mage', col2: 600, col3: 120, col4: 20, col5: 1.0, col6: damageFormula, col7: dpsFormula, col8: ehpFormula },
          },
          {
            id: 'row3',
            cells: { col1: 'Archer', col2: 800, col3: 100, col4: 35, col5: 1.2, col6: damageFormula, col7: dpsFormula, col8: ehpFormula },
          },
          {
            id: 'row4',
            cells: { col1: 'Assassin', col2: 700, col3: 130, col4: 25, col5: 1.5, col6: damageFormula, col7: dpsFormula, col8: ehpFormula },
          },
          {
            id: 'row5',
            cells: { col1: 'Paladin', col2: 1500, col3: 70, col4: 80, col5: 0.6, col6: damageFormula, col7: dpsFormula, col8: ehpFormula },
          },
        ],
        stickers: [
          {
            id: generateId(),
            text: t('samples.stickers.rpgCharacter.dps'),
            color: '#FEF3C7',
            x: 75,
            y: 1,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.rpgCharacter.ehp'),
            color: '#DBEAFE',
            x: 75,
            y: 4,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.rpgCharacter.balance'),
            color: '#D1FAE5',
            x: 75,
            y: 7,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
        ],
      },
    ],
  };
};

// ============================================
// 2. 무기 밸런싱 샘플
// ============================================
const createWeaponBalanceProject = (t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  // 수식 정의
  const dpsFormula = '=ATK*Speed*(1+CritRate*0.5)';
  const efficiencyFormula = '=DPS/Price*1000';

  return {
    id: generateId(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'Weapons',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'col1', name: 'Weapon', type: 'general', width: 120 },
          { id: 'col2', name: 'ATK', type: 'general', width: 80 },
          { id: 'col3', name: 'Speed', type: 'general', width: 80 },
          { id: 'col4', name: 'CritRate', type: 'general', width: 80 },
          { id: 'col5', name: 'Price', type: 'general', width: 100 },
          { id: 'col6', name: 'DPS', type: 'formula', width: 100, formula: dpsFormula },
          { id: 'col7', name: 'Efficiency', type: 'formula', width: 100, formula: efficiencyFormula },
        ],
        rows: [
          {
            id: 'row1',
            cells: { col1: 'Iron Sword', col2: 50, col3: 1.0, col4: 0.05, col5: 100, col6: dpsFormula, col7: efficiencyFormula },
          },
          {
            id: 'row2',
            cells: { col1: 'Steel Blade', col2: 80, col3: 1.1, col4: 0.08, col5: 300, col6: dpsFormula, col7: efficiencyFormula },
          },
          {
            id: 'row3',
            cells: { col1: 'Flame Axe', col2: 120, col3: 0.7, col4: 0.15, col5: 800, col6: dpsFormula, col7: efficiencyFormula },
          },
          {
            id: 'row4',
            cells: { col1: 'Ice Dagger', col2: 45, col3: 1.8, col4: 0.25, col5: 600, col6: dpsFormula, col7: efficiencyFormula },
          },
          {
            id: 'row5',
            cells: { col1: 'Thunder Spear', col2: 100, col3: 1.2, col4: 0.12, col5: 1000, col6: dpsFormula, col7: efficiencyFormula },
          },
          {
            id: 'row6',
            cells: { col1: 'Dragon Sword', col2: 200, col3: 1.0, col4: 0.20, col5: 5000, col6: dpsFormula, col7: efficiencyFormula },
          },
        ],
        stickers: [
          {
            id: generateId(),
            text: t('samples.stickers.weaponBalance.efficiency'),
            color: '#DBEAFE',
            x: 75,
            y: 1,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.weaponBalance.crit'),
            color: '#FEF3C7',
            x: 75,
            y: 4,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.weaponBalance.balance'),
            color: '#D1FAE5',
            x: 75,
            y: 7,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
        ],
      },
    ],
  };
};

// ============================================
// 3. 레벨업 경험치 곡선 샘플
// ============================================
const createExpCurveProject = (t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  // 수식 정의 - 지원되는 문법으로 수정
  // POWER 함수 사용 (POW 대신)
  const requiredExpFormula = '=ROUND(100*POWER(1.15,Level-1))';
  // 이전행 참조 사용 (범위 참조 대신)
  const totalExpFormula = '=RequiredEXP+PREV.TotalEXP';
  // 이전행 참조 사용
  const growthRateFormula = '=IF(PREV.RequiredEXP>0,RequiredEXP/PREV.RequiredEXP-1,0)';
  const playTimeFormula = '=ROUND(TotalEXP/50)';

  // 레벨 1-20 데이터 생성
  const rows = [];
  for (let i = 1; i <= 20; i++) {
    rows.push({
      id: `row${i}`,
      cells: {
        col1: i,
        col2: requiredExpFormula,
        col3: totalExpFormula,
        col4: growthRateFormula,
        col5: playTimeFormula,
      },
    });
  }

  return {
    id: generateId(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'EXP Table',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'col1', name: 'Level', type: 'general', width: 80 },
          { id: 'col2', name: 'RequiredEXP', type: 'formula', width: 120, formula: requiredExpFormula },
          { id: 'col3', name: 'TotalEXP', type: 'formula', width: 120, formula: totalExpFormula },
          { id: 'col4', name: 'GrowthRate', type: 'formula', width: 100, formula: growthRateFormula },
          { id: 'col5', name: 'PlayTime(min)', type: 'formula', width: 120, formula: playTimeFormula },
        ],
        rows: rows,
        stickers: [
          {
            id: generateId(),
            text: t('samples.stickers.expCurve.exponential'),
            color: '#D1FAE5',
            x: 70,
            y: 1,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.expCurve.playtime'),
            color: '#FEF3C7',
            x: 70,
            y: 4,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.expCurve.tuning'),
            color: '#EDE9FE',
            x: 70,
            y: 7,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
        ],
      },
    ],
  };
};

// ============================================
// 4. 가챠 확률 계산 샘플
// ============================================
const createGachaProject = (t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  // 수식 정의 - 컬럼명에 특수문자 제거하여 참조 가능하게 수정
  const expectedPullsFormula = '=IF(Pity>0,MIN(ROUND(100/Rate),Pity),ROUND(100/Rate))';
  const expectedCostFormula = '=ExpectedPulls*PullCost';
  const maxCostFormula = '=IF(Pity>0,Pity*PullCost,0)';

  return {
    id: generateId(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'Gacha Rates',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'col1', name: 'Grade', type: 'general', width: 100 },
          { id: 'col2', name: 'Rate', type: 'general', width: 80 },
          { id: 'col3', name: 'Pity', type: 'general', width: 80 },
          { id: 'col4', name: 'PullCost', type: 'general', width: 100 },
          { id: 'col5', name: 'ExpectedPulls', type: 'formula', width: 120, formula: expectedPullsFormula },
          { id: 'col6', name: 'ExpectedCost', type: 'formula', width: 120, formula: expectedCostFormula },
          { id: 'col7', name: 'MaxCost', type: 'formula', width: 100, formula: maxCostFormula },
        ],
        rows: [
          {
            id: 'row1',
            cells: { col1: 'SSR', col2: 0.6, col3: 90, col4: 300, col5: expectedPullsFormula, col6: expectedCostFormula, col7: maxCostFormula },
          },
          {
            id: 'row2',
            cells: { col1: 'SR', col2: 5.1, col3: 0, col4: 300, col5: expectedPullsFormula, col6: expectedCostFormula, col7: maxCostFormula },
          },
          {
            id: 'row3',
            cells: { col1: 'R', col2: 25.5, col3: 0, col4: 300, col5: expectedPullsFormula, col6: expectedCostFormula, col7: maxCostFormula },
          },
          {
            id: 'row4',
            cells: { col1: 'N', col2: 68.8, col3: 0, col4: 300, col5: expectedPullsFormula, col6: expectedCostFormula, col7: maxCostFormula },
          },
        ],
        stickers: [
          {
            id: generateId(),
            text: t('samples.stickers.gachaRates.expected'),
            color: '#EDE9FE',
            x: 70,
            y: 1,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.gachaRates.pity'),
            color: '#FEF3C7',
            x: 70,
            y: 4,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
          {
            id: generateId(),
            text: t('samples.stickers.gachaRates.monetization'),
            color: '#DBEAFE',
            x: 70,
            y: 7,
            width: 220,
            height: 80,
            fontSize: 12,
            createdAt: now,
          },
        ],
      },
    ],
  };
};

// ============================================
// 팀 PM — 스프린트 보드 (Codecks / Jira 스타일)
// ============================================
const createSprintBoardProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  return {
    id: generateId(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'Sprint Board',
        createdAt: now,
        updatedAt: now,
        activeView: 'kanban',
        columns: [
          { id: 'c-id', name: 'ID', type: 'general', width: 80 },
          { id: 'c-title', name: 'Title', type: 'general', width: 220 },
          {
            id: 'c-status',
            name: 'Status',
            type: 'select',
            width: 120,
            selectOptions: [
              { id: 'backlog', label: 'Backlog', color: '#94a3b8' },
              { id: 'todo', label: 'Todo', color: '#3b82f6' },
              { id: 'doing', label: 'Doing', color: '#f59e0b' },
              { id: 'review', label: 'Review', color: '#8b5cf6' },
              { id: 'done', label: 'Done', color: '#10b981' },
            ],
          },
          {
            id: 'c-priority',
            name: 'Priority',
            type: 'select',
            width: 100,
            selectOptions: [
              { id: 'p0', label: 'P0 Critical', color: '#ef4444' },
              { id: 'p1', label: 'P1 High', color: '#f59e0b' },
              { id: 'p2', label: 'P2 Normal', color: '#3b82f6' },
              { id: 'p3', label: 'P3 Low', color: '#94a3b8' },
            ],
          },
          {
            id: 'c-role',
            name: 'Role',
            type: 'select',
            width: 110,
            selectOptions: [
              { id: 'design', label: 'Design', color: '#ec4899' },
              { id: 'art', label: 'Art', color: '#8b5cf6' },
              { id: 'code', label: 'Code', color: '#3b82f6' },
              { id: 'qa', label: 'QA', color: '#10b981' },
              { id: 'audio', label: 'Audio', color: '#f59e0b' },
            ],
          },
          { id: 'c-assignee', name: 'Assignee', type: 'general', width: 110 },
          { id: 'c-points', name: 'Points', type: 'general', width: 80 },
          { id: 'c-due', name: 'Due', type: 'date', width: 120 },
        ],
        viewGroupColumnId: 'c-status',
        rows: [
          { id: 'r1', cells: { 'c-id': 'GAME-101', 'c-title': '보스 밸런스 재조정', 'c-status': 'doing', 'c-priority': 'p1', 'c-role': 'design', 'c-assignee': 'Daisy', 'c-points': 5, 'c-due': '2026-04-25' } },
          { id: 'r2', cells: { 'c-id': 'GAME-102', 'c-title': '스킬 아이콘 리뷰', 'c-status': 'review', 'c-priority': 'p2', 'c-role': 'art', 'c-assignee': 'Mike', 'c-points': 3, 'c-due': '2026-04-22' } },
          { id: 'r3', cells: { 'c-id': 'GAME-103', 'c-title': 'Gacha 확률 시뮬 PR', 'c-status': 'review', 'c-priority': 'p1', 'c-role': 'code', 'c-assignee': 'Jin', 'c-points': 8, 'c-due': '2026-04-23' } },
          { id: 'r4', cells: { 'c-id': 'GAME-104', 'c-title': '튜토리얼 QA 통과', 'c-status': 'todo', 'c-priority': 'p2', 'c-role': 'qa', 'c-assignee': 'Sara', 'c-points': 3 } },
          { id: 'r5', cells: { 'c-id': 'GAME-105', 'c-title': '크래시 리포트 수집 개선', 'c-status': 'backlog', 'c-priority': 'p0', 'c-role': 'code' } },
          { id: 'r6', cells: { 'c-id': 'GAME-106', 'c-title': 'BGM 루프 교체', 'c-status': 'done', 'c-priority': 'p3', 'c-role': 'audio', 'c-assignee': 'Neo', 'c-points': 2 } },
        ],
      },
    ],
  };
};

// ============================================
// 팀 PM — 버그 트래커
// ============================================
const createBugTrackerProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  return {
    id: generateId(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'Bugs',
        createdAt: now,
        updatedAt: now,
        activeView: 'grid',
        columns: [
          { id: 'c-id', name: 'ID', type: 'general', width: 80 },
          { id: 'c-title', name: 'Title', type: 'general', width: 260 },
          {
            id: 'c-severity',
            name: 'Severity',
            type: 'select',
            width: 110,
            selectOptions: [
              { id: 's1', label: 'S1 Blocker', color: '#ef4444' },
              { id: 's2', label: 'S2 Critical', color: '#f59e0b' },
              { id: 's3', label: 'S3 Major', color: '#3b82f6' },
              { id: 's4', label: 'S4 Minor', color: '#94a3b8' },
            ],
          },
          {
            id: 'c-status',
            name: 'Status',
            type: 'select',
            width: 110,
            selectOptions: [
              { id: 'open', label: 'Open', color: '#ef4444' },
              { id: 'in-progress', label: 'In Progress', color: '#f59e0b' },
              { id: 'fixed', label: 'Fixed', color: '#10b981' },
              { id: 'wontfix', label: 'Won\'t Fix', color: '#94a3b8' },
            ],
          },
          {
            id: 'c-platform',
            name: 'Platform',
            type: 'multiSelect',
            width: 140,
            selectOptions: [
              { id: 'pc', label: 'PC', color: '#3b82f6' },
              { id: 'console', label: 'Console', color: '#8b5cf6' },
              { id: 'mobile', label: 'Mobile', color: '#10b981' },
            ],
          },
          { id: 'c-reporter', name: 'Reporter', type: 'general', width: 110 },
          { id: 'c-assignee', name: 'Assignee', type: 'general', width: 110 },
          { id: 'c-created', name: 'Created', type: 'date', width: 110 },
        ],
        viewGroupColumnId: 'c-severity',
        rows: [
          { id: 'r1', cells: { 'c-id': 'BUG-001', 'c-title': '보스 2페이즈에서 무적 상태', 'c-severity': 's1', 'c-status': 'open', 'c-platform': 'pc,console', 'c-reporter': 'QA1', 'c-created': '2026-04-18' } },
          { id: 'r2', cells: { 'c-id': 'BUG-002', 'c-title': '인벤토리 정렬 후 골드 UI 깨짐', 'c-severity': 's3', 'c-status': 'in-progress', 'c-platform': 'mobile', 'c-reporter': 'Player', 'c-assignee': 'Jin', 'c-created': '2026-04-17' } },
          { id: 'r3', cells: { 'c-id': 'BUG-003', 'c-title': '튜토리얼 자막 번역 오타', 'c-severity': 's4', 'c-status': 'fixed', 'c-platform': 'pc', 'c-reporter': 'Daisy', 'c-assignee': 'Sara', 'c-created': '2026-04-15' } },
          { id: 'r4', cells: { 'c-id': 'BUG-004', 'c-title': '세이브 파일 로드 시 크래시', 'c-severity': 's1', 'c-status': 'in-progress', 'c-platform': 'console', 'c-reporter': 'QA2', 'c-assignee': 'Jin', 'c-created': '2026-04-19' } },
        ],
      },
    ],
  };
};

// ============================================
// 팀 PM — 에픽 로드맵 (Gantt)
// ============================================
const createEpicRoadmapProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  return {
    id: generateId(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'Epics',
        createdAt: now,
        updatedAt: now,
        activeView: 'gantt',
        columns: [
          { id: 'c-id', name: 'ID', type: 'general', width: 80 },
          { id: 'c-title', name: 'Epic', type: 'general', width: 240 },
          {
            id: 'c-phase',
            name: 'Phase',
            type: 'select',
            width: 120,
            selectOptions: [
              { id: 'pre-prod', label: 'Pre-production', color: '#94a3b8' },
              { id: 'prod', label: 'Production', color: '#3b82f6' },
              { id: 'beta', label: 'Beta', color: '#f59e0b' },
              { id: 'launch', label: 'Launch', color: '#10b981' },
            ],
          },
          { id: 'c-start', name: 'Start', type: 'date', width: 120 },
          { id: 'c-end', name: 'End', type: 'date', width: 120 },
          { id: 'c-owner', name: 'Owner', type: 'general', width: 120 },
        ],
        viewGroupColumnId: 'c-start',
        rows: [
          { id: 'r1', cells: { 'c-id': 'EP-01', 'c-title': '코어 전투 시스템', 'c-phase': 'prod', 'c-start': '2026-04-01', 'c-end': '2026-05-15', 'c-owner': 'Lead Design' } },
          { id: 'r2', cells: { 'c-id': 'EP-02', 'c-title': '스테이지 1~3 콘텐츠', 'c-phase': 'prod', 'c-start': '2026-04-15', 'c-end': '2026-06-01', 'c-owner': 'Content' } },
          { id: 'r3', cells: { 'c-id': 'EP-03', 'c-title': '멀티플레이 베타', 'c-phase': 'beta', 'c-start': '2026-05-20', 'c-end': '2026-07-01', 'c-owner': 'Network' } },
          { id: 'r4', cells: { 'c-id': 'EP-04', 'c-title': '런칭 마케팅', 'c-phase': 'launch', 'c-start': '2026-06-15', 'c-end': '2026-08-01', 'c-owner': 'Marketing' } },
        ],
      },
    ],
  };
};

// ============================================
// Playtest Sessions (team-pm)
// ============================================
const createPlaytestSessionsProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  const sheetId = generateId();

  return {
    id: generateId(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: sheetId,
        name: 'Playtests',
        createdAt: now,
        updatedAt: now,
        activeView: 'grid',
        columns: [
          { id: 'c-id', name: 'ID', type: 'general', width: 80 },
          { id: 'c-title', name: 'Session', type: 'general', width: 200 },
          { id: 'c-date', name: 'Date', type: 'date', width: 120 },
          { id: 'c-testers', name: 'Testers', type: 'person', width: 140 },
          { id: 'c-goals', name: 'Goals', type: 'multiSelect', width: 160, selectOptions: [
            { id: 'combat', label: 'Combat balance', color: '#ef4444' },
            { id: 'economy', label: 'Economy check', color: '#f59e0b' },
            { id: 'progression', label: 'Progression pace', color: '#10b981' },
            { id: 'onboarding', label: 'Onboarding UX', color: '#3b82f6' },
            { id: 'regression', label: 'Regression test', color: '#94a3b8' },
          ]},
          { id: 'c-status', name: 'Status', type: 'select', width: 110, selectOptions: [
            { id: 'scheduled', label: 'Scheduled', color: '#94a3b8' },
            { id: 'running', label: 'Running', color: '#3b82f6' },
            { id: 'done', label: 'Done', color: '#10b981' },
            { id: 'blocked', label: 'Blocked', color: '#ef4444' },
          ]},
          { id: 'c-rating', name: 'Overall', type: 'rating', width: 110, ratingMax: 5 },
          { id: 'c-notes', name: 'Notes', type: 'general', width: 240 },
          { id: 'c-linked-tasks', name: 'Action items', type: 'general', width: 200 },
        ],
        rows: [
          { id: 'r1', cells: {
            'c-id': 'PT-001', 'c-title': 'Sword 밸런스 검증',
            'c-date': '2026-04-25', 'c-testers': 'QA1, Daisy',
            'c-goals': 'combat,regression', 'c-status': 'scheduled',
            'c-notes': 'Sword damage 100 → 120 변경 후 첫 테스트',
          }},
          { id: 'r2', cells: {
            'c-id': 'PT-002', 'c-title': 'Gold drop rate 확인',
            'c-date': '2026-04-22', 'c-testers': 'JunhoPD, Lee',
            'c-goals': 'economy', 'c-status': 'done',
            'c-rating': 3,
            'c-notes': '3시간 플레이 후 1200 골드. 너무 적음. drop rate 1.3x 상향 제안',
            'c-linked-tasks': 'DROP-adj-042',
          }},
          { id: 'r3', cells: {
            'c-id': 'PT-003', 'c-title': '튜토리얼 first-10min',
            'c-date': '2026-04-20', 'c-testers': 'Guest-A, Guest-B',
            'c-goals': 'onboarding,progression', 'c-status': 'done',
            'c-rating': 2,
            'c-notes': '5분 지나니까 둘 다 헤맴. 튜토리얼 스킵 UI 필요.',
            'c-linked-tasks': 'UX-tut-017',
          }},
        ],
      },
    ],
  };
};

// ============================================
// 샘플 프로젝트 목록
// ============================================
export const SAMPLE_PROJECTS: SampleProject[] = [
  {
    id: 'rpg-character',
    nameKey: 'samples.rpgCharacter.name',
    descriptionKey: 'samples.rpgCharacter.description',
    icon: 'Swords',
    category: 'combat',
    createProject: createRPGCharacterProject,
  },
  {
    id: 'weapon-balance',
    nameKey: 'samples.weaponBalance.name',
    descriptionKey: 'samples.weaponBalance.description',
    icon: 'Shield',
    category: 'combat',
    createProject: createWeaponBalanceProject,
  },
  {
    id: 'exp-curve',
    nameKey: 'samples.expCurve.name',
    descriptionKey: 'samples.expCurve.description',
    icon: 'TrendingUp',
    category: 'progression',
    createProject: createExpCurveProject,
  },
  {
    id: 'gacha-rates',
    nameKey: 'samples.gachaRates.name',
    descriptionKey: 'samples.gachaRates.description',
    icon: 'Sparkles',
    category: 'gacha',
    createProject: createGachaProject,
  },
  // 장르별 완성 템플릿 (2026-04-20): FPS / MOBA / Strategy / Idle / Roguelike
  ...GENRE_SAMPLES,
  // 팀 PM 샘플 (B2B 전환, 2026-04-19)
  {
    id: 'sprint-board',
    nameKey: 'samples.sprintBoard.name',
    descriptionKey: 'samples.sprintBoard.description',
    icon: 'Kanban',
    category: 'team-pm',
    createProject: createSprintBoardProject,
  },
  {
    id: 'bug-tracker',
    nameKey: 'samples.bugTracker.name',
    descriptionKey: 'samples.bugTracker.description',
    icon: 'Bug',
    category: 'team-pm',
    createProject: createBugTrackerProject,
  },
  {
    id: 'epic-roadmap',
    nameKey: 'samples.epicRoadmap.name',
    descriptionKey: 'samples.epicRoadmap.description',
    icon: 'GanttChart',
    category: 'team-pm',
    createProject: createEpicRoadmapProject,
  },
  {
    id: 'playtest-sessions',
    nameKey: 'samples.playtestSessions.name',
    descriptionKey: 'samples.playtestSessions.description',
    icon: 'Gamepad2',
    category: 'team-pm',
    createProject: createPlaytestSessionsProject,
  },
];

// 카테고리별 필터
export const getSamplesByCategory = (category: SampleCategory): SampleProject[] => {
  return SAMPLE_PROJECTS.filter((s) => s.category === category);
};

// ID로 샘플 찾기
export const getSampleById = (id: string): SampleProject | undefined => {
  return SAMPLE_PROJECTS.find((s) => s.id === id);
};

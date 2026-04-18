import { v4 as uuidv4 } from 'uuid';
import type { Sheet, Column, Row, ColumnType } from '@/types';

// 템플릿 타입 정의
export interface SheetTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  genre?: string[]; // 적합한 장르
  columns: Omit<Column, 'id'>[];
  sampleRows?: Omit<Row, 'id'>[];
}

// 장르 정의
export const gameGenres = [
  { id: 'rpg', name: 'RPG', description: 'MMORPG, ARPG, JRPG, 턴제 등' },
  { id: 'action', name: '액션', description: '액션, 격투, 핵앤슬래시' },
  { id: 'fps', name: 'FPS/TPS', description: '슈팅 게임' },
  { id: 'strategy', name: '전략', description: 'RTS, 턴제 전략, 타워디펜스' },
  { id: 'idle', name: '방치형', description: '방치형, 클리커, 인크리멘탈' },
  { id: 'roguelike', name: '로그라이크', description: '로그라이크, 로그라이트' },
  { id: 'moba', name: 'MOBA/AOS', description: '멀티플레이어 배틀' },
  { id: 'card', name: '카드/덱빌딩', description: 'CCG, 덱빌더' },
  { id: 'puzzle', name: '퍼즐', description: '퍼즐, 매치3' },
  { id: 'simulation', name: '시뮬레이션', description: '경영, 육성, 타이쿤' },
];

// === 템플릿 정의 ===
export const sheetTemplates: SheetTemplate[] = [
  // ========== 공통 템플릿 ==========
  {
    id: 'global-config',
    name: '글로벌 설정',
    description: '게임 전체에 적용되는 기준값과 상수',
    category: 'config',
    genre: ['rpg', 'action', 'fps', 'strategy', 'idle', 'roguelike', 'moba', 'card'],
    columns: [
      { name: '변수명', type: 'text' as ColumnType, width: 150 },
      { name: '값', type: 'number' as ColumnType, width: 100 },
      { name: '단위', type: 'text' as ColumnType, width: 80 },
      { name: '설명', type: 'text' as ColumnType, width: 250 },
      { name: '비고', type: 'text' as ColumnType, width: 150 },
    ],
    sampleRows: [
      { cells: { col0: 'BASE_HP', col1: 100, col2: '', col3: '캐릭터 기본 체력 기준값', col4: '앵커값' } },
      { cells: { col0: 'BASE_ATK', col1: 10, col2: '', col3: '캐릭터 기본 공격력 기준값', col4: '앵커값' } },
      { cells: { col0: 'HP_GROWTH_RATE', col1: 1.08, col2: '%', col3: '레벨당 HP 성장률', col4: '' } },
      { cells: { col0: 'ATK_GROWTH_RATE', col1: 1.05, col2: '%', col3: '레벨당 ATK 성장률', col4: '' } },
      { cells: { col0: 'MAX_LEVEL', col1: 100, col2: '', col3: '최대 레벨', col4: '' } },
      { cells: { col0: 'CRIT_BASE', col1: 0.05, col2: '%', col3: '기본 치명타 확률', col4: '' } },
      { cells: { col0: 'CRIT_DMG_BASE', col1: 1.5, col2: 'x', col3: '기본 치명타 데미지 배율', col4: '' } },
    ],
  },

  // ========== RPG 장르 ==========
  {
    id: 'rpg-character',
    name: '[RPG] 캐릭터 스탯',
    description: 'RPG 캐릭터 기본 능력치',
    category: 'character',
    genre: ['rpg'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '이름', type: 'text' as ColumnType, width: 100 },
      { name: '등급', type: 'text' as ColumnType, width: 60 },
      { name: '역할', type: 'text' as ColumnType, width: 80 },
      { name: 'HP', type: 'number' as ColumnType, width: 80 },
      { name: 'ATK', type: 'number' as ColumnType, width: 80 },
      { name: 'DEF', type: 'number' as ColumnType, width: 80 },
      { name: 'SPD', type: 'number' as ColumnType, width: 70 },
      { name: 'CritRate', type: 'number' as ColumnType, width: 80 },
      { name: 'CritDMG', type: 'number' as ColumnType, width: 80 },
    ],
    sampleRows: [
      { cells: { col0: 'CHAR_001', col1: '아서', col2: 'SSR', col3: '탱커', col4: 1500, col5: 80, col6: 120, col7: 90, col8: 0.05, col9: 1.5 } },
      { cells: { col0: 'CHAR_002', col1: '엘레나', col2: 'SSR', col3: '딜러', col4: 800, col5: 200, col6: 50, col7: 110, col8: 0.2, col9: 2.0 } },
      { cells: { col0: 'CHAR_003', col1: '마르코', col2: 'SR', col3: '힐러', col4: 1000, col5: 60, col6: 70, col7: 100, col8: 0.1, col9: 1.5 } },
    ],
  },
  {
    id: 'rpg-level-exp',
    name: '[RPG] 레벨/경험치 테이블',
    description: '레벨업에 필요한 경험치와 스탯 증가량',
    category: 'progression',
    genre: ['rpg', 'idle'],
    columns: [
      { name: '레벨', type: 'number' as ColumnType, width: 60 },
      { name: '필요EXP', type: 'number' as ColumnType, width: 100 },
      { name: '누적EXP', type: 'number' as ColumnType, width: 100 },
      { name: 'HP+', type: 'number' as ColumnType, width: 70 },
      { name: 'ATK+', type: 'number' as ColumnType, width: 70 },
      { name: 'DEF+', type: 'number' as ColumnType, width: 70 },
    ],
    sampleRows: [
      { cells: { col0: 1, col1: 0, col2: 0, col3: 0, col4: 0, col5: 0 } },
      { cells: { col0: 2, col1: 100, col2: 100, col3: 10, col4: 2, col5: 1 } },
      { cells: { col0: 3, col1: 150, col2: 250, col3: 11, col4: 2, col5: 1 } },
      { cells: { col0: 4, col1: 225, col2: 475, col3: 12, col4: 2, col5: 1 } },
      { cells: { col0: 5, col1: 338, col2: 813, col3: 13, col4: 3, col5: 2 } },
    ],
  },
  {
    id: 'rpg-skill',
    name: '[RPG] 스킬 데이터',
    description: '스킬 정보와 데미지 배율',
    category: 'skill',
    genre: ['rpg', 'action', 'moba'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '스킬명', type: 'text' as ColumnType, width: 120 },
      { name: '타입', type: 'text' as ColumnType, width: 70 },
      { name: '배율(%)', type: 'number' as ColumnType, width: 80 },
      { name: '쿨타임(s)', type: 'number' as ColumnType, width: 80 },
      { name: '마나', type: 'number' as ColumnType, width: 70 },
      { name: '대상수', type: 'number' as ColumnType, width: 70 },
      { name: '설명', type: 'text' as ColumnType, width: 200 },
    ],
    sampleRows: [
      { cells: { col0: 'SKL_001', col1: '파워 슬래시', col2: '액티브', col3: 150, col4: 5, col5: 20, col6: 1, col7: '단일 대상 강타' } },
      { cells: { col0: 'SKL_002', col1: '회오리 베기', col2: '액티브', col3: 80, col4: 8, col5: 40, col6: 5, col7: '주변 적 공격' } },
      { cells: { col0: 'SKL_003', col1: '버서커', col2: '버프', col3: 0, col4: 60, col5: 50, col6: 0, col7: 'ATK 30% 증가 10초' } },
    ],
  },
  {
    id: 'rpg-equipment',
    name: '[RPG] 장비',
    description: '무기/방어구 스탯',
    category: 'equipment',
    genre: ['rpg', 'action'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '이름', type: 'text' as ColumnType, width: 120 },
      { name: '타입', type: 'text' as ColumnType, width: 70 },
      { name: '등급', type: 'text' as ColumnType, width: 60 },
      { name: '주스탯', type: 'text' as ColumnType, width: 80 },
      { name: '주스탯값', type: 'number' as ColumnType, width: 80 },
      { name: '부스탯', type: 'text' as ColumnType, width: 80 },
      { name: '부스탯값', type: 'number' as ColumnType, width: 80 },
    ],
    sampleRows: [
      { cells: { col0: 'EQP_001', col1: '강철검', col2: '무기', col3: 'B', col4: 'ATK', col5: 50, col6: 'CritRate', col7: 0.05 } },
      { cells: { col0: 'EQP_002', col1: '미스릴 갑옷', col2: '갑옷', col3: 'A', col4: 'DEF', col5: 80, col6: 'HP', col7: 200 } },
      { cells: { col0: 'EQP_003', col1: '속도의 장화', col2: '장화', col3: 'A', col4: 'SPD', col5: 20, col6: '', col7: 0 } },
    ],
  },
  {
    id: 'rpg-monster',
    name: '[RPG] 몬스터',
    description: '몬스터 스탯과 보상',
    category: 'enemy',
    genre: ['rpg', 'action', 'roguelike'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '이름', type: 'text' as ColumnType, width: 100 },
      { name: '타입', type: 'text' as ColumnType, width: 70 },
      { name: '레벨', type: 'number' as ColumnType, width: 60 },
      { name: 'HP', type: 'number' as ColumnType, width: 80 },
      { name: 'ATK', type: 'number' as ColumnType, width: 70 },
      { name: 'DEF', type: 'number' as ColumnType, width: 70 },
      { name: 'EXP', type: 'number' as ColumnType, width: 70 },
      { name: '골드', type: 'number' as ColumnType, width: 70 },
    ],
    sampleRows: [
      { cells: { col0: 'MON_001', col1: '슬라임', col2: '일반', col3: 1, col4: 50, col5: 10, col6: 5, col7: 10, col8: 5 } },
      { cells: { col0: 'MON_002', col1: '고블린', col2: '일반', col3: 3, col4: 120, col5: 25, col6: 10, col7: 30, col8: 15 } },
      { cells: { col0: 'MON_003', col1: '오크 대장', col2: '엘리트', col3: 5, col4: 500, col5: 60, col6: 30, col7: 150, col8: 80 } },
    ],
  },

  // ========== FPS/TPS 장르 ==========
  {
    id: 'fps-weapon',
    name: '[FPS] 무기 스탯',
    description: '총기류 데이터 (데미지, RPM, 탄창 등)',
    category: 'equipment',
    genre: ['fps'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '무기명', type: 'text' as ColumnType, width: 120 },
      { name: '타입', type: 'text' as ColumnType, width: 80 },
      { name: '데미지', type: 'number' as ColumnType, width: 70 },
      { name: 'RPM', type: 'number' as ColumnType, width: 70 },
      { name: '탄창', type: 'number' as ColumnType, width: 60 },
      { name: '재장전(s)', type: 'number' as ColumnType, width: 80 },
      { name: '사거리', type: 'number' as ColumnType, width: 70 },
      { name: '반동', type: 'number' as ColumnType, width: 60 },
    ],
    sampleRows: [
      { cells: { col0: 'WPN_001', col1: 'M4A1', col2: '돌격소총', col3: 30, col4: 700, col5: 30, col6: 2.5, col7: 100, col8: 0.3 } },
      { cells: { col0: 'WPN_002', col1: 'AWP', col2: '저격소총', col3: 115, col4: 41, col5: 5, col6: 3.5, col7: 200, col8: 0.8 } },
      { cells: { col0: 'WPN_003', col1: 'MP5', col2: 'SMG', col3: 22, col4: 800, col5: 30, col6: 2.0, col7: 50, col8: 0.2 } },
    ],
  },
  {
    id: 'fps-ttk',
    name: '[FPS] TTK 분석',
    description: 'Time To Kill 계산용 시트',
    category: 'analysis',
    genre: ['fps', 'moba'],
    columns: [
      { name: '무기', type: 'text' as ColumnType, width: 100 },
      { name: '데미지', type: 'number' as ColumnType, width: 70 },
      { name: 'RPM', type: 'number' as ColumnType, width: 70 },
      { name: '적HP', type: 'number' as ColumnType, width: 70 },
      { name: '명중률', type: 'number' as ColumnType, width: 70 },
      { name: '필요탄수', type: 'number' as ColumnType, width: 80 },
      { name: 'TTK(ms)', type: 'number' as ColumnType, width: 80 },
      { name: '비고', type: 'text' as ColumnType, width: 150 },
    ],
    sampleRows: [
      { cells: { col0: 'M4A1', col1: 30, col2: 700, col3: 100, col4: 0.7, col5: 5, col6: 343, col7: '헤드샷 미포함' } },
      { cells: { col0: 'AWP', col1: 115, col2: 41, col3: 100, col4: 0.9, col5: 1, col6: 0, col7: '원샷 원킬' } },
    ],
  },

  // ========== 방치형/Idle 장르 ==========
  {
    id: 'idle-upgrade',
    name: '[방치형] 업그레이드',
    description: '업그레이드 레벨별 효과와 비용',
    category: 'progression',
    genre: ['idle'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '업그레이드명', type: 'text' as ColumnType, width: 120 },
      { name: '레벨', type: 'number' as ColumnType, width: 60 },
      { name: '효과', type: 'number' as ColumnType, width: 80 },
      { name: '비용', type: 'number' as ColumnType, width: 100 },
      { name: '비용증가율', type: 'number' as ColumnType, width: 90 },
    ],
    sampleRows: [
      { cells: { col0: 'UPG_001', col1: '클릭 데미지', col2: 1, col3: 1, col4: 10, col5: 1.15 } },
      { cells: { col0: 'UPG_001', col1: '클릭 데미지', col2: 2, col3: 2, col4: 12, col5: 1.15 } },
      { cells: { col0: 'UPG_002', col1: '자동 공격', col2: 1, col3: 0.1, col4: 100, col5: 1.2 } },
    ],
  },
  {
    id: 'idle-prestige',
    name: '[방치형] 환생/프레스티지',
    description: '환생 보너스와 조건',
    category: 'progression',
    genre: ['idle', 'roguelike'],
    columns: [
      { name: '환생횟수', type: 'number' as ColumnType, width: 80 },
      { name: '필요조건', type: 'text' as ColumnType, width: 150 },
      { name: '보너스타입', type: 'text' as ColumnType, width: 100 },
      { name: '보너스값', type: 'number' as ColumnType, width: 80 },
      { name: '영구획득', type: 'text' as ColumnType, width: 150 },
    ],
    sampleRows: [
      { cells: { col0: 1, col1: '스테이지 50 클리어', col2: '데미지 배율', col3: 1.5, col4: '환생 포인트 +10' } },
      { cells: { col0: 2, col1: '스테이지 100 클리어', col2: '데미지 배율', col3: 2.0, col4: '환생 포인트 +20' } },
    ],
  },

  // ========== 로그라이크 장르 ==========
  {
    id: 'roguelike-relic',
    name: '[로그라이크] 유물/아티팩트',
    description: '획득 가능한 유물과 효과',
    category: 'item',
    genre: ['roguelike', 'card'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '이름', type: 'text' as ColumnType, width: 120 },
      { name: '등급', type: 'text' as ColumnType, width: 60 },
      { name: '효과타입', type: 'text' as ColumnType, width: 100 },
      { name: '효과값', type: 'number' as ColumnType, width: 80 },
      { name: '조건', type: 'text' as ColumnType, width: 150 },
      { name: '설명', type: 'text' as ColumnType, width: 200 },
    ],
    sampleRows: [
      { cells: { col0: 'REL_001', col1: '불타는 심장', col2: '레어', col3: 'ATK증가', col4: 0.25, col5: '없음', col6: '공격력 25% 증가' } },
      { cells: { col0: 'REL_002', col1: '뱀파이어 송곳니', col2: '에픽', col3: '흡혈', col4: 0.1, col5: '없음', col6: '데미지의 10% 체력 회복' } },
    ],
  },
  {
    id: 'roguelike-run',
    name: '[로그라이크] 런 보상',
    description: '층/스테이지별 보상 구성',
    category: 'reward',
    genre: ['roguelike'],
    columns: [
      { name: '층', type: 'number' as ColumnType, width: 60 },
      { name: '타입', type: 'text' as ColumnType, width: 80 },
      { name: '보상1', type: 'text' as ColumnType, width: 100 },
      { name: '보상2', type: 'text' as ColumnType, width: 100 },
      { name: '보상3', type: 'text' as ColumnType, width: 100 },
      { name: '엘리트확률', type: 'number' as ColumnType, width: 90 },
      { name: '상점확률', type: 'number' as ColumnType, width: 90 },
    ],
    sampleRows: [
      { cells: { col0: 1, col1: '전투', col2: '골드', col3: '카드', col4: '', col5: 0, col6: 0 } },
      { cells: { col0: 5, col1: '엘리트', col2: '유물', col3: '골드', col4: '카드', col5: 1, col6: 0 } },
      { cells: { col0: 10, col1: '보스', col2: '유물', col3: '골드', col4: '희귀카드', col5: 0, col6: 0.5 } },
    ],
  },

  // ========== 카드/덱빌딩 장르 ==========
  {
    id: 'card-deck',
    name: '[카드] 카드 데이터',
    description: '카드 스탯과 효과',
    category: 'card',
    genre: ['card', 'roguelike'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '카드명', type: 'text' as ColumnType, width: 120 },
      { name: '등급', type: 'text' as ColumnType, width: 60 },
      { name: '타입', type: 'text' as ColumnType, width: 70 },
      { name: '코스트', type: 'number' as ColumnType, width: 60 },
      { name: '데미지', type: 'number' as ColumnType, width: 70 },
      { name: '방어도', type: 'number' as ColumnType, width: 70 },
      { name: '효과', type: 'text' as ColumnType, width: 200 },
    ],
    sampleRows: [
      { cells: { col0: 'CRD_001', col1: '타격', col2: '기본', col3: '공격', col4: 1, col5: 6, col6: 0, col7: '' } },
      { cells: { col0: 'CRD_002', col1: '수비', col2: '기본', col3: '스킬', col4: 1, col5: 0, col6: 5, col7: '' } },
      { cells: { col0: 'CRD_003', col1: '분노의 일격', col2: '언커먼', col3: '공격', col4: 2, col5: 12, col6: 0, col7: '취약 1 부여' } },
    ],
  },

  // ========== MOBA/AOS 장르 ==========
  {
    id: 'moba-champion',
    name: '[MOBA] 챔피언/영웅',
    description: '챔피언 기본 스탯과 성장',
    category: 'character',
    genre: ['moba'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '챔피언명', type: 'text' as ColumnType, width: 100 },
      { name: '역할', type: 'text' as ColumnType, width: 80 },
      { name: 'HP(1렙)', type: 'number' as ColumnType, width: 80 },
      { name: 'HP성장', type: 'number' as ColumnType, width: 80 },
      { name: 'AD(1렙)', type: 'number' as ColumnType, width: 80 },
      { name: 'AD성장', type: 'number' as ColumnType, width: 80 },
      { name: 'AS(1렙)', type: 'number' as ColumnType, width: 80 },
      { name: 'AS성장%', type: 'number' as ColumnType, width: 80 },
    ],
    sampleRows: [
      { cells: { col0: 'CHMP_001', col1: '전사', col2: '파이터', col3: 600, col4: 95, col5: 60, col6: 3.5, col7: 0.65, col8: 2.5 } },
      { cells: { col0: 'CHMP_002', col1: '마법사', col2: '메이지', col3: 500, col4: 80, col5: 52, col6: 2.5, col7: 0.63, col8: 1.5 } },
    ],
  },

  // ========== 전략/타워디펜스 장르 ==========
  {
    id: 'td-tower',
    name: '[TD] 타워 데이터',
    description: '타워 스탯과 업그레이드',
    category: 'unit',
    genre: ['strategy'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '타워명', type: 'text' as ColumnType, width: 100 },
      { name: '타입', type: 'text' as ColumnType, width: 80 },
      { name: '데미지', type: 'number' as ColumnType, width: 70 },
      { name: '공속', type: 'number' as ColumnType, width: 60 },
      { name: '사거리', type: 'number' as ColumnType, width: 60 },
      { name: '비용', type: 'number' as ColumnType, width: 70 },
      { name: '특수효과', type: 'text' as ColumnType, width: 150 },
    ],
    sampleRows: [
      { cells: { col0: 'TWR_001', col1: '화살 타워', col2: '물리', col3: 10, col4: 1.0, col5: 5, col6: 100, col7: '' } },
      { cells: { col0: 'TWR_002', col1: '마법 타워', col2: '마법', col3: 25, col4: 0.5, col5: 4, col6: 200, col7: '관통' } },
      { cells: { col0: 'TWR_003', col1: '냉기 타워', col2: '마법', col3: 5, col4: 0.8, col5: 3, col6: 150, col7: '둔화 30%' } },
    ],
  },
  {
    id: 'td-wave',
    name: '[TD] 웨이브 구성',
    description: '웨이브별 적 구성',
    category: 'stage',
    genre: ['strategy', 'idle'],
    columns: [
      { name: '웨이브', type: 'number' as ColumnType, width: 60 },
      { name: '적ID', type: 'text' as ColumnType, width: 80 },
      { name: '수량', type: 'number' as ColumnType, width: 60 },
      { name: 'HP배율', type: 'number' as ColumnType, width: 80 },
      { name: 'SPD배율', type: 'number' as ColumnType, width: 80 },
      { name: '스폰간격(s)', type: 'number' as ColumnType, width: 100 },
      { name: '보상골드', type: 'number' as ColumnType, width: 80 },
    ],
    sampleRows: [
      { cells: { col0: 1, col1: 'ENM_001', col2: 10, col3: 1.0, col4: 1.0, col5: 1.0, col6: 50 } },
      { cells: { col0: 2, col1: 'ENM_001', col2: 15, col3: 1.1, col4: 1.0, col5: 0.9, col6: 75 } },
      { cells: { col0: 5, col1: 'ENM_BOSS', col2: 1, col3: 5.0, col4: 0.5, col5: 0, col6: 500 } },
    ],
  },

  // ========== 공통: 경제 시스템 ==========
  {
    id: 'economy-currency',
    name: '재화 설정',
    description: '게임 내 재화 종류와 획득 경로',
    category: 'economy',
    genre: ['rpg', 'idle', 'moba', 'card', 'strategy'],
    columns: [
      { name: 'ID', type: 'text' as ColumnType, width: 80 },
      { name: '재화명', type: 'text' as ColumnType, width: 100 },
      { name: '타입', type: 'text' as ColumnType, width: 80 },
      { name: '최대보유', type: 'number' as ColumnType, width: 100 },
      { name: '주획득경로', type: 'text' as ColumnType, width: 150 },
      { name: '주소비처', type: 'text' as ColumnType, width: 150 },
    ],
    sampleRows: [
      { cells: { col0: 'CUR_001', col1: '골드', col2: '소프트', col3: 999999999, col4: '전투, 퀘스트', col5: '강화, 상점' } },
      { cells: { col0: 'CUR_002', col1: '다이아', col2: '하드', col3: 999999, col4: '업적, 과금', col5: '가챠, 스태미나' } },
      { cells: { col0: 'CUR_003', col1: '스태미나', col2: '에너지', col3: 200, col4: '시간회복, 다이아', col5: '스테이지 입장' } },
    ],
  },
  {
    id: 'economy-faucet-sink',
    name: 'Faucet/Sink 분석',
    description: '재화 유입/유출 밸런스',
    category: 'economy',
    genre: ['rpg', 'idle', 'moba', 'strategy'],
    columns: [
      { name: '항목', type: 'text' as ColumnType, width: 150 },
      { name: 'F/S', type: 'text' as ColumnType, width: 60 },
      { name: '재화', type: 'text' as ColumnType, width: 80 },
      { name: '일일량', type: 'number' as ColumnType, width: 90 },
      { name: '주간량', type: 'number' as ColumnType, width: 90 },
      { name: '가정조건', type: 'text' as ColumnType, width: 200 },
    ],
    sampleRows: [
      { cells: { col0: '일일퀘스트', col1: 'F', col2: '골드', col3: 10000, col4: 70000, col5: '매일 완료 가정' } },
      { cells: { col0: '스테이지 파밍', col1: 'F', col2: '골드', col3: 50000, col4: 350000, col5: '1시간 플레이' } },
      { cells: { col0: '장비 강화', col1: 'S', col2: '골드', col3: -30000, col4: -210000, col5: '일 평균 강화 횟수' } },
      { cells: { col0: '상점 구매', col1: 'S', col2: '골드', col3: -10000, col4: -70000, col5: '' } },
    ],
  },

  // ========== 공통: 가챠/뽑기 ==========
  {
    id: 'gacha-pool',
    name: '가챠 풀',
    description: '뽑기 아이템과 확률',
    category: 'gacha',
    genre: ['rpg', 'idle', 'card'],
    columns: [
      { name: '배너ID', type: 'text' as ColumnType, width: 80 },
      { name: '아이템ID', type: 'text' as ColumnType, width: 80 },
      { name: '아이템명', type: 'text' as ColumnType, width: 120 },
      { name: '등급', type: 'text' as ColumnType, width: 60 },
      { name: '확률(%)', type: 'number' as ColumnType, width: 80 },
      { name: '픽업', type: 'text' as ColumnType, width: 60 },
    ],
    sampleRows: [
      { cells: { col0: 'BNR_001', col1: 'CHAR_001', col2: '아서', col3: 'SSR', col4: 0.6, col5: 'O' } },
      { cells: { col0: 'BNR_001', col1: 'CHAR_002', col2: '엘레나', col3: 'SSR', col4: 0.3, col5: '' } },
      { cells: { col0: 'BNR_001', col1: 'CHAR_010', col2: '마르코', col3: 'SR', col4: 5.1, col5: '' } },
    ],
  },
  {
    id: 'gacha-pity',
    name: '천장 시스템',
    description: '천장(Pity) 확률 설계',
    category: 'gacha',
    genre: ['rpg', 'idle', 'card'],
    columns: [
      { name: '등급', type: 'text' as ColumnType, width: 80 },
      { name: '기본확률(%)', type: 'number' as ColumnType, width: 100 },
      { name: '소프트천장', type: 'number' as ColumnType, width: 90 },
      { name: '하드천장', type: 'number' as ColumnType, width: 90 },
      { name: '천장증가율', type: 'number' as ColumnType, width: 100 },
      { name: '기대뽑수', type: 'number' as ColumnType, width: 90 },
    ],
    sampleRows: [
      { cells: { col0: 'SSR', col1: 0.6, col2: 74, col3: 90, col4: 6.0, col5: 62 } },
      { cells: { col0: 'SR', col1: 5.1, col2: 0, col3: 10, col4: 0, col5: 10 } },
    ],
  },

  // ========== 공통: 드랍/보상 ==========
  {
    id: 'drop-table',
    name: '드랍 테이블',
    description: '아이템 드랍 확률',
    category: 'reward',
    genre: ['rpg', 'action', 'roguelike', 'fps'],
    columns: [
      { name: '테이블ID', type: 'text' as ColumnType, width: 80 },
      { name: '소스', type: 'text' as ColumnType, width: 100 },
      { name: '아이템ID', type: 'text' as ColumnType, width: 80 },
      { name: '아이템명', type: 'text' as ColumnType, width: 100 },
      { name: '확률(%)', type: 'number' as ColumnType, width: 80 },
      { name: '최소', type: 'number' as ColumnType, width: 60 },
      { name: '최대', type: 'number' as ColumnType, width: 60 },
    ],
    sampleRows: [
      { cells: { col0: 'DRP_001', col1: '슬라임', col2: 'ITM_001', col3: 'HP 포션', col4: 30, col5: 1, col6: 2 } },
      { cells: { col0: 'DRP_001', col1: '슬라임', col2: 'MAT_001', col3: '슬라임 젤리', col4: 50, col5: 1, col6: 3 } },
    ],
  },

  // ========== 분석용 템플릿 ==========
  {
    id: 'analysis-compare',
    name: '밸런스 비교표',
    description: '캐릭터/무기 간 비교 분석',
    category: 'analysis',
    genre: ['rpg', 'fps', 'moba', 'action'],
    columns: [
      { name: '대상', type: 'text' as ColumnType, width: 100 },
      { name: 'DPS', type: 'number' as ColumnType, width: 80 },
      { name: 'EHP', type: 'number' as ColumnType, width: 80 },
      { name: 'TTK(s)', type: 'number' as ColumnType, width: 80 },
      { name: '기동성', type: 'number' as ColumnType, width: 80 },
      { name: '유틸', type: 'number' as ColumnType, width: 80 },
      { name: '총점', type: 'number' as ColumnType, width: 80 },
      { name: '평가', type: 'text' as ColumnType, width: 100 },
    ],
    sampleRows: [
      { cells: { col0: '전사', col1: 150, col2: 2000, col3: 5.0, col4: 60, col5: 30, col6: 78, col7: 'A' } },
      { cells: { col0: '마법사', col1: 300, col2: 800, col3: 3.0, col4: 50, col5: 70, col6: 82, col7: 'S' } },
    ],
  },
];

// 카테고리 정의
export const templateCategories = [
  { id: 'config', name: '설정', icon: '' },
  { id: 'character', name: '캐릭터', icon: '' },
  { id: 'equipment', name: '장비', icon: '' },
  { id: 'skill', name: '스킬', icon: '' },
  { id: 'enemy', name: '적/몬스터', icon: '' },
  { id: 'unit', name: '유닛', icon: '' },
  { id: 'item', name: '아이템', icon: '' },
  { id: 'card', name: '카드', icon: '' },
  { id: 'stage', name: '스테이지', icon: '' },
  { id: 'progression', name: '성장', icon: '' },
  { id: 'economy', name: '경제', icon: '' },
  { id: 'gacha', name: '가챠', icon: '' },
  { id: 'reward', name: '보상', icon: '' },
  { id: 'analysis', name: '분석', icon: '' },
];

// 템플릿으로 시트 생성
export function createSheetFromTemplate(template: SheetTemplate): Sheet {
  const now = Date.now();

  // 컬럼 생성 (ID 부여)
  const columns: Column[] = template.columns.map((col) => ({
    ...col,
    id: uuidv4(),
  }));

  // 샘플 데이터 생성 (컬럼 ID 매핑)
  const rows: Row[] = (template.sampleRows || []).map((sampleRow) => {
    const cells: Record<string, string | number | null> = {};

    // col0, col1, col2... 형식의 키를 실제 컬럼 ID로 매핑
    Object.entries(sampleRow.cells).forEach(([key, value]) => {
      const index = parseInt(key.replace('col', ''));
      if (!isNaN(index) && columns[index]) {
        cells[columns[index].id] = value;
      }
    });

    return {
      id: uuidv4(),
      cells,
    };
  });

  return {
    id: uuidv4(),
    name: template.name,
    columns,
    rows,
    createdAt: now,
    updatedAt: now,
  };
}

// 템플릿 검색
export function searchTemplates(query: string): SheetTemplate[] {
  const lowerQuery = query.toLowerCase();
  return sheetTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  );
}

// 카테고리별 템플릿 가져오기
export function getTemplatesByCategory(category: string): SheetTemplate[] {
  return sheetTemplates.filter((t) => t.category === category);
}

// 장르별 템플릿 가져오기
export function getTemplatesByGenre(genre: string): SheetTemplate[] {
  return sheetTemplates.filter((t) => t.genre?.includes(genre));
}

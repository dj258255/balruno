import type { ColumnType } from '@/types';
import type { SheetTemplate } from './types';

/**
 * 성장/레벨링 관련 템플릿
 * 레벨 경험치, 업그레이드, 환생 시스템 등
 */
export const progressionTemplates: SheetTemplate[] = [
  // 레벨/경험치 테이블
  {
    id: 'rpg-level-exp',
    name: '레벨경험치테이블',
    description: '레벨업 필요 경험치와 스탯 성장. 글로벌 설정 참조.',
    category: 'progression',
    genre: ['rpg', 'idle'],
    context: '기본 EXP=일반몹 10마리 처치(10×10=100). 글로벌설정의 GROWTH_RATE(1.08) 적용',
    keyMetrics: [
      'EXP 증가율 1.5: 레벨당 50% 더 많은 경험치 필요',
      '스탯 성장률 1.08: 글로벌설정 참조. 50렙 시 기준 대비 47배',
      '목표 플레이타임: 2렙(10분) → 10렙(3시간) → 30렙(3일) → 50렙(2주)',
    ],
    dependencies: [
      {
        templateId: 'global-config',
        sheetName: '글로벌설정',
        description: 'BASE_HP, BASE_ATK, GROWTH_RATE 값 참조',
      },
    ],
    columns: [
      { name: '레벨', type: 'general' as ColumnType, width: 60, exportName: 'level' },
      { name: 'EXP기준', type: 'general' as ColumnType, width: 80, exportName: 'baseExp' },
      { name: 'EXP증가율', type: 'general' as ColumnType, width: 85, exportName: 'expGrowthRate' },
      { name: '필요EXP', type: 'formula' as ColumnType, width: 100, exportName: 'requiredExp' },
      { name: '누적EXP', type: 'formula' as ColumnType, width: 100, exportName: 'totalExp' },
      { name: '성장률', type: 'general' as ColumnType, width: 70, exportName: 'growthRate' },
      { name: 'HP', type: 'formula' as ColumnType, width: 100, exportName: 'hp' },
      { name: 'ATK', type: 'formula' as ColumnType, width: 100, exportName: 'atk' },
      { name: '예상도달시간', type: 'general' as ColumnType, width: 110, exportName: 'estimatedTime' },
      { name: '설계의도', type: 'general' as ColumnType, width: 280, exportExcluded: true },
    ],
    sampleRows: [
      {
        cells: {
          col0: 1,
          col1: 100,
          col2: 1.5,
          col3: 0,
          col4: 0,
          col5: 1.08,
          col6: '=글로벌설정.BASE_HP',
          col7: '=글로벌설정.BASE_ATK',
          col8: '시작',
          col9: 'EXP기준 100 = 일반몹(EXP 10) 10마리. 튜토리얼에서 즉시 달성 가능',
        },
      },
      {
        cells: {
          col0: 2,
          col1: 100,
          col2: 1.5,
          col3: '=EXP기준*POWER(EXP증가율, 레벨-2)',
          col4: '=이전행.누적EXP+필요EXP',
          col5: 1.08,
          col6: '=글로벌설정.BASE_HP*POWER(성장률, 레벨-1)',
          col7: '=글로벌설정.BASE_ATK*POWER(성장률, 레벨-1)',
          col8: '10분',
          col9: '필요EXP 100. 일반몹 10마리=50초(5초×10). 이동/대기 포함 10분',
        },
      },
      {
        cells: {
          col0: 10,
          col1: 100,
          col2: 1.5,
          col3: '=EXP기준*POWER(EXP증가율, 레벨-2)',
          col4: '=이전행.누적EXP+필요EXP',
          col5: 1.08,
          col6: '=글로벌설정.BASE_HP*POWER(성장률, 레벨-1)',
          col7: '=글로벌설정.BASE_ATK*POWER(성장률, 레벨-1)',
          col8: '3시간',
          col9: '필요EXP 3,844. 누적 7,600. HP 1,999, ATK 200. 초반 구간 종료',
        },
      },
      {
        cells: {
          col0: 30,
          col1: 100,
          col2: 1.5,
          col3: '=EXP기준*POWER(EXP증가율, 레벨-2)',
          col4: '=이전행.누적EXP+필요EXP',
          col5: 1.08,
          col6: '=글로벌설정.BASE_HP*POWER(성장률, 레벨-1)',
          col7: '=글로벌설정.BASE_ATK*POWER(성장률, 레벨-1)',
          col8: '3일',
          col9: '필요EXP 191만. 누적 380만. HP 9,317, ATK 932. 중반 콘텐츠 벽',
        },
      },
      {
        cells: {
          col0: 50,
          col1: 100,
          col2: 1.5,
          col3: '=EXP기준*POWER(EXP증가율, 레벨-2)',
          col4: '=이전행.누적EXP+필요EXP',
          col5: 1.08,
          col6: '=글로벌설정.BASE_HP*POWER(성장률, 레벨-1)',
          col7: '=글로벌설정.BASE_ATK*POWER(성장률, 레벨-1)',
          col8: '2주',
          col9: '필요EXP 4.3억. 누적 8.6억. HP 43,427, ATK 4,343. 엔드콘텐츠 입장',
        },
      },
    ],
  },

  // 방치형 업그레이드
  {
    id: 'idle-upgrade',
    name: '업그레이드테이블',
    description: '업그레이드 비용과 효과. 비용 증가율 vs 효과 증가율 밸런스.',
    category: 'progression',
    genre: ['idle'],
    context: '비용 증가율 > 효과 증가율 → 한계효용 체감. 다양한 업그레이드 분산 유도',
    keyMetrics: [
      '기준 클릭데미지 1 = 1렙몹 HP 10의 10%. 10클릭에 처치',
      '비용 증가율 1.15: 10레벨 비용 = 1레벨의 4배 (1.15^9=3.5)',
      '효율 체감: 10레벨 효율 = 1레벨의 25% → 다른 업그레이드로 분산 유도',
    ],
    columns: [
      { name: 'ID', type: 'general' as ColumnType, width: 80, exportName: 'id' },
      { name: '업그레이드명', type: 'general' as ColumnType, width: 120, exportName: 'upgradeName' },
      { name: '레벨', type: 'general' as ColumnType, width: 55, exportName: 'level' },
      { name: '효과기준', type: 'general' as ColumnType, width: 75, exportName: 'baseEffect' },
      { name: '효과', type: 'formula' as ColumnType, width: 100, exportName: 'effect' },
      { name: '효과단위', type: 'general' as ColumnType, width: 90, exportName: 'effectUnit' },
      { name: '비용기준', type: 'general' as ColumnType, width: 75, exportName: 'baseCost' },
      { name: '비용증가율', type: 'general' as ColumnType, width: 85, exportName: 'costGrowthRate' },
      { name: '비용', type: 'formula' as ColumnType, width: 100, exportName: 'cost' },
      { name: '효율', type: 'formula' as ColumnType, width: 90, exportName: 'efficiency' },
      { name: '설계의도', type: 'general' as ColumnType, width: 280, exportExcluded: true },
    ],
    sampleRows: [
      {
        cells: {
          col0: 'UPG_001',
          col1: '클릭 데미지',
          col2: 1,
          col3: 1,
          col4: '=효과기준*레벨',
          col5: '+N 데미지/클릭',
          col6: 10,
          col7: 1.15,
          col8: '=비용기준*POWER(비용증가율, 레벨-1)',
          col9: '=효과/비용',
          col10: '효과1, 비용10 → 효율0.1. 10클릭=10데미지=1렙몹처치',
        },
      },
      {
        cells: {
          col0: 'UPG_001',
          col1: '클릭 데미지',
          col2: 10,
          col3: 1,
          col4: '=효과기준*레벨',
          col5: '+N 데미지/클릭',
          col6: 10,
          col7: 1.15,
          col8: '=비용기준*POWER(비용증가율, 레벨-1)',
          col9: '=효과/비용',
          col10: '효과10, 비용35 → 효율0.29. 1렙대비 효율29%로 체감',
        },
      },
      {
        cells: {
          col0: 'UPG_002',
          col1: '자동 공격',
          col2: 1,
          col3: 0.1,
          col4: '=효과기준*레벨',
          col5: '+N DPS (초당)',
          col6: 100,
          col7: 1.15,
          col8: '=비용기준*POWER(비용증가율, 레벨-1)',
          col9: '=효과/비용',
          col10: '초당0.1데미지. 클릭10배비용으로 방치플레이 전환. 10렙시 1DPS',
        },
      },
      {
        cells: {
          col0: 'UPG_003',
          col1: '크리티컬 확률',
          col2: 1,
          col3: 0.01,
          col4: '=효과기준*레벨',
          col5: '+N% 크리확률',
          col6: 500,
          col7: 1.15,
          col8: '=비용기준*POWER(비용증가율, 레벨-1)',
          col9: '=효과/비용',
          col10: '1렙당 1%확률. 50렙시 50%확률. 고비용 후반 업그레이드',
        },
      },
    ],
  },

  // 환생/프레스티지 시스템
  {
    id: 'idle-prestige',
    name: '환생시스템',
    description: '환생(리셋) 보너스와 조건. 장기 성장 동기 부여.',
    category: 'progression',
    genre: ['idle', 'roguelike'],
    context: '환생 1회 = 2~3일 진행 단축. 10회 환생 후 콘텐츠 확장',
    keyMetrics: [
      '환생 조건: 현재 진행의 50~70% 지점',
      '환생 보너스: 1.5~2.0배 데미지 (체감되는 파워)',
      '영구 획득: 다음 런 시작 상태 개선',
    ],
    columns: [
      { name: '환생횟수', type: 'general' as ColumnType, width: 85, exportName: 'prestigeCount' },
      { name: '필요조건', type: 'general' as ColumnType, width: 140, exportName: 'requirement' },
      { name: '예상소요시간', type: 'general' as ColumnType, width: 100, exportName: 'estimatedTime' },
      { name: '데미지배율', type: 'general' as ColumnType, width: 95, exportName: 'damageMultiplier' },
      { name: '누적배율', type: 'formula' as ColumnType, width: 90, exportName: 'cumulativeMultiplier' },
      { name: '영구획득', type: 'general' as ColumnType, width: 150, exportName: 'permanentReward' },
      { name: '설계의도', type: 'general' as ColumnType, width: 250, exportExcluded: true },
    ],
    sampleRows: [
      {
        cells: {
          col0: 1,
          col1: '스테이지 50 클리어',
          col2: '3일',
          col3: 1.5,
          col4: 1.5,
          col5: '환생 스킬 해금',
          col6: '첫 환생. 1.5배로 체감 상승. 시스템 이해',
        },
      },
      {
        cells: {
          col0: 2,
          col1: '스테이지 50 클리어',
          col2: '2일',
          col3: 1.5,
          col4: '=이전행.누적배율*데미지배율',
          col5: '환생 포인트 +10',
          col6: '누적 2.25배. 1차보다 1일 단축. 성장 체감',
        },
      },
      {
        cells: {
          col0: 5,
          col1: '스테이지 75 클리어',
          col2: '3일',
          col3: 1.5,
          col4: '=POWER(1.5, 환생횟수)',
          col5: '자동스킬 해금',
          col6: '누적 7.6배. 조건 상향. 새 콘텐츠 개방',
        },
      },
      {
        cells: {
          col0: 10,
          col1: '스테이지 100 클리어',
          col2: '4일',
          col3: 2.0,
          col4: '=POWER(1.5, 환생횟수-1)*2',
          col5: '2차 환생 시스템 해금',
          col6: '누적 76배. 특별 보너스 2배. 새 층위 개방',
        },
      },
    ],
  },
];

import type { ColumnType } from '@/types';
import type { SheetTemplate } from './types';

/**
 * 경제 시스템 관련 템플릿
 * Faucet/Sink, 재화 시스템, 가챠 등
 */
export const economyTemplates: SheetTemplate[] = [
  // 가챠/뽑기 확률 테이블
  {
    id: 'gacha-pool',
    name: '가챠 확률 설계',
    description: '등급별 확률과 천장 시스템. 기대값 기반 수익 설계.',
    category: 'gacha',
    genre: ['rpg', 'idle', 'card'],
    context: '최고 등급 1개 획득까지 기대 비용 $50~100 권장 (업계 표준)',
    keyMetrics: [
      '기본 확률 → 기대 뽑수 = 1/확률',
      '천장 적용 시 실제 기대 뽑수 감소',
      '픽업 확률 = 등급 확률 × 픽업 비율',
    ],
    columns: [
      { name: '등급', type: 'general' as ColumnType, width: 70, exportName: 'grade' },
      { name: '기본확률(%)', type: 'general' as ColumnType, width: 95, exportName: 'baseProbability' },
      { name: '기대뽑수', type: 'formula' as ColumnType, width: 90, exportName: 'expectedPulls' },
      { name: '소프트천장', type: 'general' as ColumnType, width: 90, exportName: 'softPity' },
      { name: '하드천장', type: 'general' as ColumnType, width: 85, exportName: 'hardPity' },
      { name: '천장증가율', type: 'general' as ColumnType, width: 90, exportName: 'pityIncreaseRate' },
      { name: '실제기대뽑수', type: 'general' as ColumnType, width: 100, exportName: 'actualExpectedPulls' },
      { name: '1뽑당비용', type: 'general' as ColumnType, width: 90, exportName: 'costPerPull' },
      { name: '획득비용', type: 'formula' as ColumnType, width: 90, exportName: 'totalCost' },
      { name: '설계의도', type: 'general' as ColumnType, width: 250, exportExcluded: true },
    ],
    sampleRows: [
      {
        cells: {
          col0: 'SSR',
          col1: 0.6,
          col2: '=100/기본확률(%)',
          col3: 74,
          col4: 90,
          col5: 6.0,
          col6: 62,
          col7: 1.5,
          col8: '=실제기대뽑수*1뽑당비용',
          col9: '기대 167뽑이지만 천장으로 62뽑. 획득비용 $93',
        },
      },
      {
        cells: {
          col0: 'SR',
          col1: 5.1,
          col2: '=100/기본확률(%)',
          col3: 0,
          col4: 10,
          col5: 0,
          col6: 10,
          col7: 1.5,
          col8: '=실제기대뽑수*1뽑당비용',
          col9: '기대 20뽑. 하드천장 10으로 보장. 획득비용 $15',
        },
      },
      {
        cells: {
          col0: 'R',
          col1: 25.5,
          col2: '=100/기본확률(%)',
          col3: 0,
          col4: 0,
          col5: 0,
          col6: 4,
          col7: 1.5,
          col8: '=실제기대뽑수*1뽑당비용',
          col9: '기대 4뽑. 천장 없이도 충분히 획득. 볼륨 역할',
        },
      },
    ],
  },

  // 경제 시스템 - Faucet/Sink
  {
    id: 'economy-faucet-sink',
    name: '경제 Faucet/Sink 분석',
    description: '재화 유입(Faucet)과 유출(Sink) 밸런스. 인플레이션 제어.',
    category: 'economy',
    genre: ['rpg', 'idle', 'moba', 'strategy'],
    context: 'Faucet:Sink = 1:0.7~0.9 권장. 약간의 잉여로 성장감, 과잉은 인플레',
    keyMetrics: [
      '총 Faucet = 45,000 (퀘10K+파밍30K+출석5K)',
      '총 Sink = 35,000 (강화25K+상점10K)',
      '일일 순수익 = 10,000 (저축률 22%)',
    ],
    columns: [
      { name: '항목', type: 'general' as ColumnType, width: 130, exportName: 'item' },
      { name: 'F/S', type: 'general' as ColumnType, width: 50, exportName: 'faucetOrSink' },
      { name: '재화', type: 'general' as ColumnType, width: 70, exportName: 'currency' },
      { name: '일일량', type: 'general' as ColumnType, width: 90, exportName: 'dailyAmount' },
      { name: '주간량', type: 'formula' as ColumnType, width: 90, exportName: 'weeklyAmount' },
      { name: '총Faucet', type: 'general' as ColumnType, width: 85, exportName: 'totalFaucet' },
      { name: '비율(%)', type: 'formula' as ColumnType, width: 100, exportName: 'ratio' },
      { name: '가정조건', type: 'general' as ColumnType, width: 150, exportExcluded: true },
      { name: '설계의도', type: 'general' as ColumnType, width: 200, exportExcluded: true },
    ],
    sampleRows: [
      {
        cells: {
          col0: '일일퀘스트',
          col1: 'F',
          col2: '골드',
          col3: 10000,
          col4: '=일일량*7',
          col5: 45000,
          col6: '=일일량/총Faucet*100',
          col7: '매일 완료 가정',
          col8: 'Faucet의 22%. 기본 수입원',
        },
      },
      {
        cells: {
          col0: '스테이지 파밍',
          col1: 'F',
          col2: '골드',
          col3: 30000,
          col4: '=일일량*7',
          col5: 45000,
          col6: '=일일량/총Faucet*100',
          col7: '1시간 플레이 기준',
          col8: 'Faucet의 67%. 플레이 보상 핵심',
        },
      },
      {
        cells: {
          col0: '출석 보너스',
          col1: 'F',
          col2: '골드',
          col3: 5000,
          col4: '=일일량*7',
          col5: 45000,
          col6: '=일일량/총Faucet*100',
          col7: '매일 접속',
          col8: 'Faucet의 11%. 무조건 획득',
        },
      },
      {
        cells: {
          col0: '장비 강화',
          col1: 'S',
          col2: '골드',
          col3: -25000,
          col4: '=일일량*7',
          col5: 45000,
          col6: '=ABS(일일량)/총Faucet*100',
          col7: '일 평균 5회 강화',
          col8: 'Faucet의 56% 소비. 주력 Sink',
        },
      },
      {
        cells: {
          col0: '상점 구매',
          col1: 'S',
          col2: '골드',
          col3: -10000,
          col4: '=일일량*7',
          col5: 45000,
          col6: '=ABS(일일량)/총Faucet*100',
          col7: '일일 상점 한정 구매',
          col8: 'Faucet의 22% 소비. 지출 유도',
        },
      },
      {
        cells: {
          col0: '순수익',
          col1: '-',
          col2: '골드',
          col3: 10000,
          col4: '=일일량*7',
          col5: 45000,
          col6: '=일일량/총Faucet*100',
          col7: 'Faucet-Sink',
          col8: '저축률 22%(10K/45K). 목표 10~30% 내',
        },
      },
    ],
  },

  // 재화 설정
  {
    id: 'economy-currency',
    name: '재화 시스템 설계',
    description: '게임 내 재화 종류, 용도, 획득/소비 경로.',
    category: 'economy',
    genre: ['rpg', 'idle', 'moba', 'card', 'strategy'],
    context: '재화 종류는 3~5개 권장. 너무 많으면 복잡, 적으면 단조로움',
    keyMetrics: [
      '소프트 재화: 무제한 획득, 자유 사용 (골드)',
      '하드 재화: 제한 획득, 희소 가치 (다이아)',
      '에너지: 회복 제한, 플레이 제한 (스태미나)',
    ],
    columns: [
      { name: 'ID', type: 'general' as ColumnType, width: 80, exportName: 'id' },
      { name: '재화명', type: 'general' as ColumnType, width: 90, exportName: 'currencyName' },
      { name: '타입', type: 'general' as ColumnType, width: 70, exportName: 'type' },
      { name: '최대보유', type: 'general' as ColumnType, width: 100, exportName: 'maxCapacity' },
      { name: '주획득경로', type: 'general' as ColumnType, width: 140, exportName: 'mainSource' },
      { name: '주소비처', type: 'general' as ColumnType, width: 140, exportName: 'mainSink' },
      { name: '일일획득량', type: 'general' as ColumnType, width: 95, exportName: 'dailyIncome' },
      { name: '설계의도', type: 'general' as ColumnType, width: 250, exportExcluded: true },
    ],
    sampleRows: [
      {
        cells: {
          col0: 'CUR_001',
          col1: '골드',
          col2: '소프트',
          col3: 999999999,
          col4: '전투, 퀘스트, 판매',
          col5: '강화, 상점, 제작',
          col6: 45000,
          col7: '기본 경제 재화. 무제한 파밍. 주요 Sink로 순환',
        },
      },
      {
        cells: {
          col0: 'CUR_002',
          col1: '다이아',
          col2: '하드',
          col3: 99999,
          col4: '업적, 이벤트, 과금',
          col5: '가챠, 스태미나 충전',
          col6: 100,
          col7: '프리미엄 재화. 일 100개로 무과금 플레이 가능',
        },
      },
      {
        cells: {
          col0: 'CUR_003',
          col1: '스태미나',
          col2: '에너지',
          col3: 200,
          col4: '시간회복(5분/1), 다이아',
          col5: '스테이지 입장(10/회)',
          col6: 288,
          col7: '5분당 1회복→1시간12개→24시간288개. 최대200은 16.7시간분. 아침 풀충전→저녁까지 유지',
        },
      },
      {
        cells: {
          col0: 'CUR_004',
          col1: '명예 포인트',
          col2: '소프트',
          col3: 50000,
          col4: 'PvP 보상',
          col5: 'PvP 상점',
          col6: 500,
          col7: 'PvP 전용 재화. 별도 경제권으로 PvE 무관',
        },
      },
    ],
  },
];

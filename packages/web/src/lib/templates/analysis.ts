import type { ColumnType } from '@/types';
import type { SheetTemplate } from './types';

/**
 * 분석 관련 템플릿
 * 밸런스 비교 분석표 등
 */
export const analysisTemplates: SheetTemplate[] = [
  // 밸런스 비교 분석표
  {
    id: 'analysis-compare',
    name: '밸런스 비교 분석표',
    description: '캐릭터/무기 간 객관적 비교. 정량 지표로 밸런스 검증.',
    category: 'analysis',
    genre: ['rpg', 'fps', 'moba', 'action'],
    context: '같은 등급 내 총점 ±10% 이내 유지. 역할별 특화 허용',
    keyMetrics: [
      'DPS/EHP는 캐릭터시트에서 참조. =캐릭터스탯.CHAR_ID.DPS',
      '정규화: MAX(DPS)=300(암살자) 기준 상대 점수',
      'S등급 = 90점 이상, A등급 = 75~89점',
    ],
    dependencies: [
      {
        templateId: 'rpg-character',
        sheetName: '캐릭터스탯',
        description: 'DPS, EHP 값 참조 (시트명.캐릭터ID.컬럼명 형식)',
      },
    ],
    columns: [
      { name: '대상', type: 'general' as ColumnType, width: 100, exportName: 'target' },
      { name: '역할', type: 'general' as ColumnType, width: 70, exportName: 'role' },
      { name: 'DPS출처', type: 'general' as ColumnType, width: 130, exportName: 'dpsSource' },
      { name: 'DPS', type: 'formula' as ColumnType, width: 80, exportName: 'dps' },
      { name: 'DPS점수', type: 'formula' as ColumnType, width: 85, exportName: 'dpsScore' },
      { name: 'EHP출처', type: 'general' as ColumnType, width: 130, exportName: 'ehpSource' },
      { name: 'EHP', type: 'formula' as ColumnType, width: 80, exportName: 'ehp' },
      { name: 'EHP점수', type: 'formula' as ColumnType, width: 85, exportName: 'ehpScore' },
      { name: '유틸점수', type: 'general' as ColumnType, width: 80, exportName: 'utilityScore' },
      { name: '종합점수', type: 'formula' as ColumnType, width: 85, exportName: 'totalScore' },
      { name: '등급', type: 'formula' as ColumnType, width: 55, exportName: 'grade' },
      { name: '분석', type: 'general' as ColumnType, width: 250, exportName: 'analysis' },
    ],
    sampleRows: [
      {
        cells: {
          col0: '철갑 기사',
          col1: '탱커',
          col2: 'CHAR_001',
          col3: '=캐릭터스탯.CHAR_001.DPS',
          col4: '=DPS/300*40',
          col5: 'CHAR_001',
          col6: '=캐릭터스탯.CHAR_001.EHP',
          col7: '=EHP/3750*40',
          col8: 15,
          col9: '=DPS점수+EHP점수+유틸점수',
          col10: '=IF(종합점수>=90,"S",IF(종합점수>=75,"A","B"))',
          col11: 'DPS 85(28%)→11점, EHP 3750(100%)→40점. 유틸15점. 총66점=A',
        },
      },
      {
        cells: {
          col0: '암살자',
          col1: '딜러',
          col2: 'CHAR_002',
          col3: '=캐릭터스탯.CHAR_002.DPS',
          col4: '=DPS/300*40',
          col5: 'CHAR_002',
          col6: '=캐릭터스탯.CHAR_002.EHP',
          col7: '=EHP/3750*40',
          col8: 5,
          col9: '=DPS점수+EHP점수+유틸점수',
          col10: '=IF(종합점수>=90,"S",IF(종합점수>=75,"A","B"))',
          col11: 'DPS 300(100%)→40점, EHP 980(26%)→10점. 유틸5점. 총55점=B. 딜 특화',
        },
      },
      {
        cells: {
          col0: '사제',
          col1: '힐러',
          col2: 'CHAR_003',
          col3: '=캐릭터스탯.CHAR_003.DPS',
          col4: '=DPS/300*40',
          col5: 'CHAR_003',
          col6: '=캐릭터스탯.CHAR_003.EHP',
          col7: '=EHP/3750*40',
          col8: 35,
          col9: '=DPS점수+EHP점수+유틸점수',
          col10: '=IF(종합점수>=90,"S",IF(종합점수>=75,"A","B"))',
          col11: 'DPS 65(22%)→9점, EHP 1590(42%)→17점. 유틸35점(힐). 총61점=B',
        },
      },
      {
        cells: {
          col0: '마법사',
          col1: '딜러',
          col2: 'CHAR_004',
          col3: '=캐릭터스탯.CHAR_004.DPS',
          col4: '=DPS/300*40',
          col5: 'CHAR_004',
          col6: '=캐릭터스탯.CHAR_004.EHP',
          col7: '=EHP/3750*40',
          col8: 20,
          col9: '=DPS점수+EHP점수+유틸점수',
          col10: '=IF(종합점수>=90,"S",IF(종합점수>=75,"A","B"))',
          col11: 'DPS 200(67%)→27점, EHP 1160(31%)→12점. 유틸20점(범위기). 총59점=B',
        },
      },
    ],
  },
];

import type { ColumnType } from '@/types';
import type { SheetTemplate } from './types';

/**
 * 글로벌 설정 템플릿
 * 게임 전체의 기준점이 되는 앵커값 시트
 */
export const configTemplates: SheetTemplate[] = [
  {
    id: 'global-config',
    name: '글로벌설정',
    description: '게임 전체의 기준점이 되는 상수값(앵커값). 다른 모든 시트가 이 값을 참조함.',
    category: 'config',
    genre: ['rpg', 'action', 'fps', 'strategy', 'idle', 'roguelike', 'moba', 'card'],
    context: '밸런스 조정 시 이 시트의 값만 바꾸면 전체 게임에 반영됨',
    keyMetrics: ['앵커값 = 모든 계산의 기준점', '여기서 정한 값이 게임 전체 난이도를 결정'],
    columns: [
      { name: '변수명', type: 'general' as ColumnType, width: 150, exportName: 'variableName' },
      { name: '값', type: 'general' as ColumnType, width: 100, exportName: 'value' },
      { name: '단위', type: 'general' as ColumnType, width: 60, exportName: 'unit' },
      { name: '산출근거', type: 'general' as ColumnType, width: 300, exportExcluded: true },
      { name: '영향범위', type: 'general' as ColumnType, width: 200, exportExcluded: true },
    ],
    sampleRows: [
      {
        cells: {
          col0: 'BASE_HP',
          col1: 1000,
          col2: '',
          col3: '1레벨 플레이어가 일반몬스터에게 3~5회 피격 시 사망하도록 설계. 몬스터 ATK 250 기준, 1000/(250*0.8)≈5회',
          col4: '모든 캐릭터 HP 계산의 기준',
        },
      },
      {
        cells: {
          col0: 'BASE_ATK',
          col1: 100,
          col2: '',
          col3: '일반몬스터(HP 500)를 5~7타에 처치. 100*6=600으로 약간의 오버킬 여유',
          col4: '모든 캐릭터/무기 공격력 기준',
        },
      },
      {
        cells: {
          col0: 'BASE_DEF',
          col1: 50,
          col2: '',
          col3: '감소율 공식 적용 시 DEF 50이면 약 33% 데미지 감소 (100/(100+50))',
          col4: '모든 캐릭터/장비 방어력 기준',
        },
      },
      {
        cells: {
          col0: 'TTK_TARGET',
          col1: 5,
          col2: '초',
          col3: 'RPG 장르 권장 TTK 5~30초 중 액션성 강조하여 하한선 채택',
          col4: 'DPS, 적 HP 설계 기준',
        },
      },
      {
        cells: {
          col0: 'GROWTH_RATE',
          col1: 1.08,
          col2: 'x/레벨',
          col3: '지수 성장률 1.05~1.15 중간값. 50레벨 시 약 47배 성장',
          col4: '레벨업 시 스탯 증가 계수',
        },
      },
      {
        cells: {
          col0: 'CRIT_RATE_BASE',
          col1: 0.05,
          col2: '%',
          col3: '기본 5%. 장비/버프로 최대 50% 도달 설계',
          col4: '치명타 확률 기준',
        },
      },
      {
        cells: {
          col0: 'CRIT_DMG_BASE',
          col1: 1.5,
          col2: 'x',
          col3: '기본 150%. 특화 빌드 시 200~250% 도달 설계',
          col4: '치명타 데미지 배율 기준',
        },
      },
      {
        cells: {
          col0: 'DEF_CAP',
          col1: 0.7,
          col2: '%',
          col3: '최대 70% 데미지 감소. 탱커도 무적이 아니게 상한선 설정',
          col4: '방어력 감소율 상한',
        },
      },
    ],
  },
];

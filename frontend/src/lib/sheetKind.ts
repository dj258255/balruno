/**
 * 시트 용도(kind) 결정 로직.
 *
 * 우선순위:
 *   1. Sheet.kind 명시값 (유저 설정)
 *   2. PM 시트 자동 감지 (detectPmSheet) → 'pm'
 *   3. 기본 'game-data'
 */

import type { ColumnType, Sheet, SheetKind } from '@/types';
import { detectPmSheet } from './pmSheetDetection';
import { COLUMN_TYPE_META } from './columnTypeMeta';

export interface SheetKindMeta {
  kind: SheetKind;
  label: string;
  description: string;
  color: string;
  /** 엔진 Export (Unity/Unreal/Godot/JSON) 허용 여부 */
  engineExportable: boolean;
  /** 수동 override 인지 자동 감지인지 */
  source: 'manual' | 'auto-pm' | 'default';
}

export const KIND_META: Record<SheetKind, Omit<SheetKindMeta, 'source'>> = {
  'game-data': {
    kind: 'game-data',
    label: '게임 데이터',
    description: '빌드에 들어가는 밸런스 데이터 (Unity/Unreal/JSON Export 가능)',
    color: '#3b82f6',
    engineExportable: true,
  },
  'pm': {
    kind: 'pm',
    label: '팀 PM',
    description: '스프린트 · 버그 · 로드맵 · 플레이테스트 (Export 불가, 내부 작업용)',
    color: '#f59e0b',
    engineExportable: false,
  },
  'analysis': {
    kind: 'analysis',
    label: '분석',
    description: '민감도 · 시뮬 결과 · 임시 분석 (내부만, Export 불가)',
    color: '#8b5cf6',
    engineExportable: false,
  },
  'reference': {
    kind: 'reference',
    label: '참조',
    description: '읽기 전용 자료 · 벤치마크 · 이전 버전 (Export 불가)',
    color: '#6b7280',
    engineExportable: false,
  },
};

export function resolveSheetKind(sheet: Sheet): SheetKindMeta {
  if (sheet.kind) {
    return { ...KIND_META[sheet.kind], source: 'manual' };
  }
  const pm = detectPmSheet(sheet);
  if (pm.type) {
    return { ...KIND_META.pm, source: 'auto-pm' };
  }
  return { ...KIND_META['game-data'], source: 'default' };
}

export function isEngineExportable(sheet: Sheet): boolean {
  return resolveSheetKind(sheet).engineExportable;
}

/**
 * 시트 용도에서 추천되는 컬럼 타입 목록 — 신규 컬럼 빠른 preset 등에 활용.
 * COLUMN_TYPE_META.recommendedIn 을 inverse 로 모은 결과.
 */
export function getRecommendedColumnTypes(kind: SheetKind): ColumnType[] {
  return Object.values(COLUMN_TYPE_META)
    .filter((m) => m.recommendedIn.includes(kind))
    .map((m) => m.type);
}

export function groupSheetsByKind(sheets: Sheet[]): Record<SheetKind, Sheet[]> {
  const groups: Record<SheetKind, Sheet[]> = {
    'game-data': [],
    'pm': [],
    'analysis': [],
    'reference': [],
  };
  for (const s of sheets) {
    const meta = resolveSheetKind(s);
    groups[meta.kind].push(s);
  }
  return groups;
}

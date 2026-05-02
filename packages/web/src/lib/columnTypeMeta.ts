/**
 * 컬럼 타입(ColumnType) 메타데이터.
 *
 * 시트 용도(SheetKind) 별 노출/추천 정책을 한 곳에 모아둠. UI 는 이 파일을
 * 단일 진실원으로 읽고, picker 가시성/배지/검증을 일관되게 처리한다.
 *
 * 정책:
 *  - shownIn 비어있으면 모든 SheetKind 에서 노출
 *  - recommendedIn 에 포함된 SheetKind 에서 "추천" 배지
 *  - dim/접힘 여부는 UI 가 shownIn 와 현재 sheet.kind 비교해서 결정
 */
import {
  Type,
  CheckSquare,
  Calendar,
  Link as LinkIcon,
  ListOrdered,
  Tags,
  Star,
  DollarSign,
  ExternalLink,
  Sigma,
  Search,
  ListTree,
  ClipboardList,
  User,
  Camera,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ColumnType, SheetKind } from '@/types';

export type ColumnCategory =
  | 'basic'
  | 'choice'
  | 'format'
  | 'relational'
  | 'computed'
  | 'pm'
  | 'balance';

export interface ColumnTypeMeta {
  type: ColumnType;
  category: ColumnCategory;
  Icon: LucideIcon;
  /** i18n key 또는 평문 라벨 (i18n 키 추가 전까지 평문 fallback) */
  label: string;
  /** 한 줄 설명 — picker 그리드 셀 hint */
  description: string;
  /** 실제 셀 표시 미리보기 (예: "5 ⭐", "₩1,200") */
  preview?: string;
  /** 노출되는 시트 용도. 빈 배열이면 모든 용도에서 노출 */
  shownIn: SheetKind[];
  /** 추천 배지가 붙는 시트 용도 */
  recommendedIn: SheetKind[];
}

const ALL_KINDS: SheetKind[] = ['game-data', 'pm', 'analysis', 'reference'];

export const COLUMN_TYPE_META: Record<ColumnType, ColumnTypeMeta> = {
  general: {
    type: 'general',
    category: 'basic',
    Icon: Type,
    label: '일반',
    description: '숫자/텍스트 자동 감지',
    preview: '100  ·  Hero',
    shownIn: ALL_KINDS,
    recommendedIn: ['game-data', 'analysis', 'reference'],
  },
  checkbox: {
    type: 'checkbox',
    category: 'basic',
    Icon: CheckSquare,
    label: 'Checkbox',
    description: '참/거짓 토글',
    preview: '✓ / □',
    shownIn: ALL_KINDS,
    recommendedIn: ['pm'],
  },
  date: {
    type: 'date',
    category: 'basic',
    Icon: Calendar,
    label: 'Date',
    description: '날짜/마감일',
    preview: '2026-05-02',
    shownIn: ALL_KINDS,
    recommendedIn: ['pm', 'analysis'],
  },
  url: {
    type: 'url',
    category: 'basic',
    Icon: ExternalLink,
    label: 'URL',
    description: '링크 (외부 자료)',
    preview: 'docs.google.com/...',
    shownIn: ALL_KINDS,
    recommendedIn: ['reference', 'pm'],
  },

  select: {
    type: 'select',
    category: 'choice',
    Icon: Tags,
    label: 'Select',
    description: '단일 선택 (드롭다운)',
    preview: '● Common',
    shownIn: ALL_KINDS,
    recommendedIn: ['game-data', 'pm'],
  },
  multiSelect: {
    type: 'multiSelect',
    category: 'choice',
    Icon: ListOrdered,
    label: 'Multi-select',
    description: '복수 선택 (태그)',
    preview: '● Fire ● Ice',
    shownIn: ALL_KINDS,
    recommendedIn: ['game-data', 'pm'],
  },
  rating: {
    type: 'rating',
    category: 'choice',
    Icon: Star,
    label: 'Rating',
    description: '별점 / 점수',
    preview: '★★★★☆',
    shownIn: ALL_KINDS,
    recommendedIn: ['analysis'],
  },

  currency: {
    type: 'currency',
    category: 'format',
    Icon: DollarSign,
    label: 'Currency',
    description: '통화 (₩, $)',
    preview: '₩ 1,200',
    shownIn: ALL_KINDS,
    recommendedIn: ['game-data'],
  },

  link: {
    type: 'link',
    category: 'relational',
    Icon: LinkIcon,
    label: 'Link',
    description: '다른 시트 row 참조',
    preview: '→ Heroes / Knight',
    shownIn: ALL_KINDS,
    recommendedIn: ['game-data', 'pm'],
  },
  lookup: {
    type: 'lookup',
    category: 'relational',
    Icon: Search,
    label: 'Lookup',
    description: 'Link 경유 값 가져오기',
    preview: '↳ HP: 800',
    shownIn: ALL_KINDS,
    recommendedIn: ['game-data', 'analysis'],
  },
  rollup: {
    type: 'rollup',
    category: 'relational',
    Icon: ListTree,
    label: 'Rollup',
    description: 'Link 경유 집계 (SUM/AVG)',
    preview: 'Σ 12,400',
    shownIn: ALL_KINDS,
    recommendedIn: ['analysis'],
  },

  formula: {
    type: 'formula',
    category: 'computed',
    Icon: Sigma,
    label: '수식',
    description: '열 전체에 수식 적용',
    preview: '=ATK * 1.5',
    shownIn: ALL_KINDS,
    recommendedIn: ['game-data', 'analysis'],
  },

  'task-link': {
    type: 'task-link',
    category: 'pm',
    Icon: ClipboardList,
    label: 'Task Link',
    description: '셀 → 태스크 시트 연결',
    preview: '⚑ Sprint-3 / In Progress',
    shownIn: ['pm', 'analysis'],
    recommendedIn: ['pm'],
  },
  person: {
    type: 'person',
    category: 'pm',
    Icon: User,
    label: 'Person',
    description: '담당자 (멀티 유저)',
    preview: '@beomsu',
    shownIn: ['pm', 'analysis'],
    recommendedIn: ['pm'],
  },

  'stat-snapshot': {
    type: 'stat-snapshot',
    category: 'balance',
    Icon: Camera,
    label: 'Stat Snapshot',
    description: '밸런스 스냅샷 참조 (이력)',
    preview: '◷ HP:800 ATK:120 ...',
    shownIn: ['pm', 'analysis'],
    recommendedIn: ['pm', 'analysis'],
  },
};

export interface ColumnCategoryMeta {
  category: ColumnCategory;
  label: string;
  description: string;
  /** 이 카테고리가 "주력" 인 시트 용도. 다른 시트 용도에선 dim 처리 권장 */
  primaryFor: SheetKind[];
}

export const COLUMN_CATEGORY_META: Record<ColumnCategory, ColumnCategoryMeta> = {
  basic: {
    category: 'basic',
    label: '기본',
    description: '텍스트/숫자/날짜/체크박스',
    primaryFor: ALL_KINDS,
  },
  choice: {
    category: 'choice',
    label: '선택지',
    description: '드롭다운 / 태그 / 별점',
    primaryFor: ALL_KINDS,
  },
  format: {
    category: 'format',
    label: '포맷',
    description: '통화 등 표시 형식',
    primaryFor: ['game-data'],
  },
  relational: {
    category: 'relational',
    label: '관계',
    description: '다른 시트 참조 · 룩업 · 롤업',
    primaryFor: ['game-data', 'analysis'],
  },
  computed: {
    category: 'computed',
    label: '계산',
    description: '수식',
    primaryFor: ['game-data', 'analysis'],
  },
  pm: {
    category: 'pm',
    label: 'PM 도구',
    description: '태스크 연결 · 담당자',
    primaryFor: ['pm'],
  },
  balance: {
    category: 'balance',
    label: '밸런스 이력',
    description: '스탯 스냅샷',
    primaryFor: ['pm', 'analysis'],
  },
};

const CATEGORY_ORDER: ColumnCategory[] = [
  'basic',
  'choice',
  'format',
  'relational',
  'computed',
  'pm',
  'balance',
];

/** 특정 시트 용도에서 노출되는 컬럼 타입 목록 (카테고리별 묶음). */
export function getColumnTypesByCategory(
  kind: SheetKind,
): Array<{ category: ColumnCategoryMeta; types: ColumnTypeMeta[]; isPrimary: boolean }> {
  const grouped: Record<ColumnCategory, ColumnTypeMeta[]> = {
    basic: [],
    choice: [],
    format: [],
    relational: [],
    computed: [],
    pm: [],
    balance: [],
  };
  for (const meta of Object.values(COLUMN_TYPE_META)) {
    if (meta.shownIn.length > 0 && !meta.shownIn.includes(kind)) continue;
    grouped[meta.category].push(meta);
  }
  return CATEGORY_ORDER.map((category) => ({
    category: COLUMN_CATEGORY_META[category],
    types: grouped[category],
    isPrimary: COLUMN_CATEGORY_META[category].primaryFor.includes(kind),
  })).filter((g) => g.types.length > 0);
}

/** 시트 용도에서 컬럼 타입이 사용 가능한지 (Phase 2 가드용) */
export function isColumnTypeAllowed(type: ColumnType, kind: SheetKind): boolean {
  const meta = COLUMN_TYPE_META[type];
  return meta.shownIn.length === 0 || meta.shownIn.includes(kind);
}

/** 시트 용도 변경 시 호환되지 않는 컬럼 타입 (Phase 2 변경 차단 다이얼로그용) */
export function getIncompatibleColumnTypes(
  currentTypes: ColumnType[],
  targetKind: SheetKind,
): ColumnType[] {
  const incompatible = new Set<ColumnType>();
  for (const type of currentTypes) {
    if (!isColumnTypeAllowed(type, targetKind)) incompatible.add(type);
  }
  return Array.from(incompatible);
}

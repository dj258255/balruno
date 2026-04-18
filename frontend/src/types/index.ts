// 폴더 타입 (시트들을 그룹화)
export interface Folder {
  id: string;
  name: string;
  color?: string;           // 폴더 색상 (선택적)
  parentId?: string;        // 상위 폴더 ID (중첩 폴더용, 없으면 루트)
  isExpanded?: boolean;     // 폴더 펼침 상태
  createdAt: number;
  updatedAt: number;
}

// 동기화 모드
export type ProjectSyncMode = 'local' | 'cloud';

// 프로젝트 타입
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  sheets: Sheet[];
  folders?: Folder[];       // 폴더 목록
  // 동기화 설정
  syncMode?: ProjectSyncMode;  // 'local' (기본) | 'cloud'
  syncRoomId?: string;         // 클라우드 모드 시 협업 룸 ID
}

// 스티커 타입
export interface Sticker {
  id: string;
  text: string;
  color: string;  // 배경색
  x: number;      // 위치 X (퍼센트)
  y: number;      // 위치 Y (퍼센트)
  width: number;  // 너비 (px)
  height: number; // 높이 (px)
  fontSize?: number;
  createdAt: number;
}

// Track 4 — 뷰 타입
export type ViewType = 'grid' | 'form' | 'kanban' | 'calendar' | 'gallery' | 'gantt';

// 시트 타입
export interface Sheet {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
  stickers?: Sticker[];  // 스티커 목록
  exportClassName?: string;  // 게임 엔진 내보내기 시 사용할 클래스명 (영문)
  folderId?: string;     // 소속 폴더 ID (없으면 루트)
  /** Track 4: 현재 활성 뷰 (기본 'grid'). 단일 뷰 MVP — 다중 뷰 저장은 추후 */
  activeView?: ViewType;
  /** Track 4: Kanban/Calendar/Gallery 뷰에서 그룹/날짜 기준 컬럼 ID */
  viewGroupColumnId?: string;
  createdAt: number;
  updatedAt: number;
}

// 컬럼 타입 — Track 1 (Field 확장)
// general: 자동 감지 (기존), formula: 컬럼 전체 수식 (기존)
// + 기본 7종: checkbox/select/multiSelect/date/url/currency/rating
// Track 2/3 에서 추가될 예정: link/lookup/rollup/attachment
export type ColumnType =
  | 'general'
  | 'formula'
  | 'checkbox'
  | 'select'
  | 'multiSelect'
  | 'date'
  | 'url'
  | 'currency'
  | 'rating'
  | 'link'      // Track 2: 다른 시트 레코드 참조 (단방향 MVP)
  | 'lookup'    // Track 3: link 통해 연결된 레코드의 특정 컬럼 값 가져오기
  | 'rollup';   // Track 3: link 통해 연결된 레코드들 집계 (SUM/AVG/MIN/MAX/COUNT)

// 선택 옵션 (select / multiSelect 공용)
export interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

// 데이터 타입 (유효성 검사용)
export type DataType = 'any' | 'number' | 'integer' | 'text';

// 유효성 검사 설정
export interface ValidationConfig {
  dataType?: DataType;      // 데이터 타입 제한
  min?: number;             // 최솟값
  max?: number;             // 최댓값
  required?: boolean;       // 필수 입력
  allowedValues?: string[]; // 허용된 값 목록 (enum)
}

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  width?: number;
  formula?: string;         // type이 'formula'일 때
  validation?: ValidationConfig;  // 유효성 검사 설정
  locked?: boolean;         // 잠금 여부
  exportName?: string;      // 게임 엔진 내보내기 시 사용할 영문 필드명
  exportExcluded?: boolean; // 내보내기 제외 여부

  // Track 1 — Field 타입별 설정
  /** select/multiSelect 의 선택지 */
  selectOptions?: SelectOption[];
  /** currency 포맷: 통화 기호 (₩, $, 원) + 소수점 자릿수 */
  currencyFormat?: { symbol: string; decimals: number };
  /** rating 최대 별점 (기본 5) */
  ratingMax?: number;
  /** date 포맷 (기본 'YYYY-MM-DD') */
  dateFormat?: string;

  // Track 2 — Linked Records (양방향 미러링)
  /** type='link': 참조 대상 시트 ID */
  linkedSheetId?: string;
  /** type='link': 표시용 컬럼 (대상 시트의 컬럼 ID, 보통 이름/ID 컬럼) */
  linkedDisplayColumnId?: string;
  /** type='link': 다중 참조 허용 여부 (false=1:1, true=1:N) */
  linkedMultiple?: boolean;
  /** type='link': 반대쪽 시트의 자동 생성된 reverse 컬럼 ID (양방향 동기화용) */
  reverseColumnId?: string;
  /** 자동 생성된 reverse 컬럼 표시 (UI 에서 "자동 생성됨" 뱃지) */
  isReverseLink?: boolean;

  // Track 3 — Lookup / Rollup
  /** type='lookup'/'rollup': 현재 시트의 link 컬럼 ID (참조 경로) */
  lookupLinkColumnId?: string;
  /** type='lookup'/'rollup': 가져올 대상 시트의 컬럼 ID */
  lookupTargetColumnId?: string;
  /** type='rollup': 집계 함수 */
  rollupAggregate?: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'CONCAT';
}

// 행 타입
export interface Row {
  id: string;
  cells: Record<string, CellValue>;
  cellStyles?: Record<string, CellStyle>;  // 셀별 스타일 (columnId -> CellStyle)
  cellMemos?: Record<string, string>;       // 셀별 메모 (columnId -> memo text)
  locked?: boolean;  // 행 잠금 여부
  height?: number;   // 행 높이 (px)
}

// 셀 값 타입
export type CellValue = string | number | null;

// 셀 포맷팅 (Fortune-Sheet/Luckysheet 패턴)
export interface CellStyle {
  bold?: boolean;           // bl: bold
  italic?: boolean;         // it: italic
  underline?: boolean;      // un: underline
  strikethrough?: boolean;  // cl: strikethrough
  fontSize?: number;        // fs: font size (10-36)
  fontColor?: string;       // fc: font color (hex)
  bgColor?: string;         // bg: background color (hex)
  hAlign?: 'left' | 'center' | 'right';  // ht: horizontal align
  vAlign?: 'top' | 'middle' | 'bottom';  // vt: vertical align
  textRotation?: number;    // tr: 0, 45, 90, -45, -90, vertical
}

// 셀 데이터 (값 + 스타일)
export interface CellData {
  value: CellValue;
  style?: CellStyle;
}

// 수식 평가 결과
export interface FormulaResult {
  value: CellValue;
  error?: string;
  warnings?: string[];  // 경고 메시지 (참조를 찾았지만 값이 0으로 처리됨 등)
}

// 참조 에러 타입
export interface ReferenceError {
  type: 'sheet_not_found' | 'variable_not_found' | 'column_not_found' | 'circular_reference';
  reference: string;
  message: string;
}

// 성장 곡선 타입
export type CurveType = 'linear' | 'exponential' | 'logarithmic' | 'quadratic' | 'scurve';

// 오버라이드 보간 방식
export type InterpolationType = 'linear' | 'step' | 'ease-in-out';

export interface CurveParams {
  type: CurveType;
  base: number;
  rate: number;
  maxLevel?: number;
  // S-curve용
  max?: number;
  mid?: number;
  // Quadratic용
  a?: number;
  b?: number;
  c?: number;
}

// 차트 데이터
export interface ChartDataPoint {
  level: number;
  value: number;
  [key: string]: number;
}

// 내보내기 옵션
export interface ExportOptions {
  format: 'json' | 'csv';
  sheets?: string[]; // 특정 시트만 내보내기
  includeFormulas?: boolean;
}

// 저장소 메타데이터
export interface StorageMetadata {
  lastSaved: number;
  lastBackup: number;
  version: string;
}

// ============================================
// 엔티티 정의 시스템 (레벨별 스탯 자동 생성)
// ============================================

// 스탯별 성장 곡선 설정
export interface StatGrowthConfig {
  curveType: CurveType;
  growthRate: number;      // 성장률 (예: 1.08 = 8% 증가)
}

// 오버라이드 포인트 (특정 레벨의 스탯을 수동 지정)
export interface StatOverride {
  level: number;
  stats: Record<string, number>;  // 스탯명 -> 값
}

// 엔티티 정의 (캐릭터/몬스터 등)
export interface EntityDefinition {
  id: string;
  name: string;
  entityType: 'character' | 'monster' | 'npc' | 'item';

  // 기본 스탯 (레벨 1 기준)
  baseStats: Record<string, number>;  // { hp: 1000, atk: 100, def: 50 }

  // 스탯별 성장 곡선 설정
  growthCurves: Record<string, StatGrowthConfig>;

  // 최대 레벨
  maxLevel: number;

  // 오버라이드 포인트 (선택적)
  overrides: StatOverride[];

  // 추가 메타데이터
  tags?: string[];
  description?: string;
}

// 레벨 테이블 생성 설정
export interface LevelTableConfig {
  entityIds: string[];      // 생성할 엔티티 ID 목록
  minLevel: number;         // 시작 레벨 (보통 1)
  maxLevel: number;         // 최대 레벨
  outputMode: 'new-sheet' | 'current-sheet' | 'per-entity';
  sheetNamePattern?: string; // 시트명 패턴 (예: "{entity}_레벨테이블")
}

// 생성된 레벨 테이블 행
export interface LevelTableRow {
  entityId: string;
  entityName: string;
  level: number;
  stats: Record<string, number>;
  isOverridden: Record<string, boolean>;  // 어떤 스탯이 오버라이드되었는지
}

// 시트 메타데이터 (확장)
export interface SheetMetadata {
  type?: 'standard' | 'entity-definition' | 'level-table';
  sourceEntityIds?: string[];  // 레벨 테이블인 경우: 원본 엔티티 ID들
  generatedAt?: number;
}

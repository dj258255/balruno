import { create } from 'zustand';
import type {
  Project,
  Sheet,
  Column,
  Row,
  CellValue,
  CellStyle,
  Doc,
} from '@/types';
import { createProjectActions } from './slices/projectSlice';
import { createSheetActions } from './slices/sheetSlice';
import { createCellActions } from './slices/cellSlice';
import { createSelectionActions } from './slices/selectionSlice';
import { createDocActions, bindDocSliceGetters } from './slices/docSlice';
import { createLegacyStubActions } from './slices/legacyStubSlice';
import { createTreeMutationActions } from './slices/treeMutationSlice';

// ==== 보조 타입 ====

/** 여러 행을 동시에 선택한 상태의 표현 (비교/분석 패널에서 사용) */
export interface SelectedRowData {
  rowId: string;
  sheetId: string;
  sheetName: string;
  name: string;
  values: Record<string, number | string>;
}

/** 외부에서 "셀을 고르게 하는" 모드 (예: 이코노미 패널에서 DPS 셀 참조 선택) */
export interface CellSelectionMode {
  active: boolean;
  fieldLabel: string;
  callback: ((value: number, rowId?: string, columnId?: string) => void) | null;
}

/** 상단 탭바 entry — 시트/문서 단일 배열 순서로 섞임. 드래그 재정렬 지원. */
export type TabEntry =
  | { kind: 'sheet'; id: string }
  | { kind: 'doc'; id: string };

// ==== 스토어 상태 ====

export interface ProjectState {
  // 상태
  projects: Project[];
  currentProjectId: string | null;
  currentSheetId: string | null;
  /** 시트·문서 통합 탭 배열 — 한 줄에 섞인 순서대로 저장. 드래그 재정렬 지원. */
  openTabs: TabEntry[];
  isLoading: boolean;
  lastSaved: number | null;
  selectedRows: SelectedRowData[];
  cellSelectionMode: CellSelectionMode;

  // 프로젝트 액션 — 로컬 UI 상태만. CRUD 는 backend REST.
  setCurrentProject: (id: string | null) => void;
  loadProjects: (projects: Project[]) => void;

  // 시트 액션 — 로컬 UI 상태만. CRUD 는 sheet tree wire ops (/lib/tree).
  setCurrentSheet: (id: string | null) => void;
  /** View metadata patch — activeView, viewGroupColumnId, Kanban cover
   *  col, Calendar end col, Gantt depends col, etc. Broadcasts via
   *  sheet.metadata.update wire op. */
  updateSheetMetadata: (
    projectId: string,
    sheetId: string,
    patch: import('@/lib/sync/opMapper').SheetMetadataPatch,
    options?: { origin?: 'local' | 'remote' },
  ) => void;

  // 컬럼 액션
  addColumn: (
    projectId: string,
    sheetId: string,
    column: Omit<Column, 'id'>,
    options?: { origin?: 'local' | 'remote'; columnId?: string; skipUndoPush?: boolean }
  ) => string;
  insertColumn: (
    projectId: string,
    sheetId: string,
    column: Omit<Column, 'id'>,
    atIndex: number
  ) => string;
  updateColumn: (
    projectId: string,
    sheetId: string,
    columnId: string,
    updates: Partial<Column>,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => void;
  deleteColumn: (
    projectId: string,
    sheetId: string,
    columnId: string,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => void;
  reorderColumns: (projectId: string, sheetId: string, columnIds: string[]) => void;

  // 행 액션
  addRow: (
    projectId: string,
    sheetId: string,
    cells?: Record<string, CellValue>,
    options?: { origin?: 'local' | 'remote'; rowId?: string; skipUndoPush?: boolean }
  ) => string;
  insertRow: (
    projectId: string,
    sheetId: string,
    atIndex: number,
    cells?: Record<string, CellValue>,
    options?: { origin?: 'local' | 'remote'; rowId?: string }
  ) => string;
  updateRow: (projectId: string, sheetId: string, rowId: string, updates: Partial<Row>) => void;
  updateCell: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    value: CellValue,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => void;
  updateCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    style: Partial<CellStyle>
  ) => void;
  updateCellsStyle: (
    projectId: string,
    sheetId: string,
    cells: Array<{ rowId: string; columnId: string }>,
    style: Partial<CellStyle>
  ) => void;
  getCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string
  ) => CellStyle | undefined;
  deleteRow: (
    projectId: string,
    sheetId: string,
    rowId: string,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => void;
  /** 단일 row 를 sheet.rows 안의 새 위치(targetIndex) 로 이동. Kanban 컬럼 내 정렬용. */
  reorderRow: (
    projectId: string,
    sheetId: string,
    rowId: string,
    targetIndex: number,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => void;
  addMultipleRows: (projectId: string, sheetId: string, count: number) => void;

  // 유틸리티
  getCurrentProject: () => Project | null;
  getCurrentSheet: () => Sheet | null;
  getSheet: (projectId: string, sheetId: string) => Sheet | null;
  setLastSaved: (timestamp: number) => void;

  // 행 선택 액션
  selectRow: (data: SelectedRowData) => void;
  deselectRow: (rowId: string) => void;
  clearSelectedRows: () => void;
  toggleRowSelection: (data: SelectedRowData) => void;

  // 셀 선택 모드 액션
  startCellSelection: (
    fieldLabel: string,
    callback: (value: number, rowId?: string, columnId?: string) => void
  ) => void;
  completeCellSelection: (value: number, rowId?: string, columnId?: string) => void;
  cancelCellSelection: () => void;

  // 문서 액션 (Phase A — Doc 계층, Notion 식 nested 트리)
  currentDocId: string | null;
  createDoc: (
    projectId: string,
    name: string,
    content?: string,
    options?: { parentId?: string },
  ) => string;
  updateDoc: (
    projectId: string,
    docId: string,
    updates: Partial<Pick<Doc, 'name' | 'content' | 'icon' | 'parentId' | 'isExpanded' | 'position'>>
  ) => void;
  deleteDoc: (projectId: string, docId: string) => void;
  /** 부모 변경 — Notion 식 트리에서 다른 위치로 이동. parentId === undefined 면 루트로. */
  moveDoc: (projectId: string, docId: string, parentId: string | undefined, position?: number) => void;
  /** 사이드바 펼침/접힘 토글. */
  toggleDocExpanded: (projectId: string, docId: string) => void;
  setCurrentDoc: (docId: string | null) => void;
  openDocTab: (docId: string) => void;
  closeDocTab: (docId: string) => void;

  // ── Legacy v0.5 stubs ────────────────────────────────────────────
  // The v0.6 cleanup moved local-mode multi-project state to
  // server-canonical REST. The Sidebar/SheetTabs/BranchModal still
  // call these by name; the actual mutation paths are pending the
  // D-3/E-4 follow-up. Stubs surface a clear alert when a button
  // whose action is not yet rewired is clicked, so the regression
  // is loud, not silent. See {@link ./slices/legacyStubSlice.ts}.
  createProject: (name: string, options?: unknown) => string;
  duplicateProject: (projectId: string) => string;
  deleteProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  createFromSample: (...args: unknown[]) => string;
  reorderProjects: (...args: unknown[]) => void;
  createSheet: (...args: unknown[]) => string;
  updateSheet: (projectId: string, sheetId: string, updates: Partial<Sheet>) => void;
  duplicateSheet: (projectId: string, sheetId: string) => string;
  deleteSheet: (projectId: string, sheetId: string) => void;
  reorderSheets: (...args: unknown[]) => void;
  moveSheetToFolder: (projectId: string, sheetId: string, folderId: string | null) => void;
  moveSheetToProject: (fromProjectId: string, sheetId: string, toProjectId: string) => void;
  createFolder: (projectId: string, name: string, parentId?: string) => string;
  updateFolder: (projectId: string, folderId: string, updates: unknown) => void;
  deleteFolder: (projectId: string, folderId: string) => void;
  moveFolderToFolder: (projectId: string, folderId: string, parentId: string | null) => void;
  toggleFolderExpanded: (projectId: string, folderId: string) => void;
  closeSheetTab: (sheetId: string) => void;
  reorderOpenTabs: (fromIndex: number, toIndex: number) => void;
  updateSticker: (sheetId: string, stickerId: string, updates: unknown) => void;
  deleteSticker: (sheetId: string, stickerId: string) => void;
  exportProject: (projectId: string) => unknown;
  importProject: (data: unknown) => void;
}

// ==== 스토어 구성 ====

export const useProjectStore = create<ProjectState>((set, get) => ({
  // 초기 상태
  projects: [],
  currentProjectId: null,
  currentSheetId: null,
  openTabs: [],
  isLoading: false,
  lastSaved: null,
  selectedRows: [],
  cellSelectionMode: { active: false, fieldLabel: '', callback: null },
  currentDocId: null,

  // 액션은 슬라이스에서 주입
  ...createProjectActions(set, get),
  ...createSheetActions(set, get),
  ...createCellActions(set, get),
  ...createSelectionActions(set, get),
  ...createDocActions(set),
  ...createLegacyStubActions(),
  // Override stub mutations with server-canonical re-wires. Spread
  // last so the live implementations win over the alert stubs.
  ...createTreeMutationActions(set, get),
}));

// Wire docSlice getters now that the store is created (avoids circular import).
bindDocSliceGetters((projectId) =>
  useProjectStore.getState().projects.find((p) => p.id === projectId),
);

// dev 모드에서만 콘솔 디버깅용으로 window 에 노출. 데이터 무결성 점검·일회성
// 쿼리 등에 활용. 프로덕션 빌드에선 NODE_ENV 가 'production' 이라 미노출.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { useProjectStore: typeof useProjectStore }).useProjectStore =
    useProjectStore;
}

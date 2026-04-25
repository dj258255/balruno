import { create } from 'zustand';
import type {
  Project,
  Sheet,
  Column,
  Row,
  CellValue,
  Sticker,
  CellStyle,
  Folder,
  Doc,
} from '@/types';
import { createProjectActions } from './slices/projectSlice';
import { createSheetActions } from './slices/sheetSlice';
import { createCellActions } from './slices/cellSlice';
import { createSelectionActions } from './slices/selectionSlice';
import { createDocActions } from './slices/docSlice';

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

  // 프로젝트 액션
  createProject: (name: string, description?: string, options?: { seedStarter?: boolean }) => string;
  createFromSample: (
    sampleId: string,
    name: string,
    t: (key: string) => string,
    description?: string
  ) => string | null;
  updateProject: (
    id: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'syncMode' | 'syncRoomId' | 'visibility'>>
  ) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string;
  reorderProjects: (fromIndex: number, toIndex: number) => void;
  setCurrentProject: (id: string | null) => void;
  loadProjects: (projects: Project[]) => void;

  // 시트 액션
  createSheet: (projectId: string, name: string, exportClassName?: string) => string;
  updateSheet: (
    projectId: string,
    sheetId: string,
    updates: Partial<Pick<Sheet,
      | 'name'
      | 'icon'
      | 'kind'
      | 'exportClassName'
      | 'activeView'
      | 'viewGroupColumnId'
      | 'viewKanbanCoverColumnId'
      | 'viewKanbanFieldIds'
      | 'viewCalendarEndColumnId'
      | 'viewGanttEndColumnId'
      | 'viewGanttDependsColumnId'
      | 'savedViews'
      | 'activeSavedViewId'
      | 'filterGroup'
    >>
  ) => void;
  deleteSheet: (projectId: string, sheetId: string) => void;
  setCurrentSheet: (id: string | null) => void;
  duplicateSheet: (projectId: string, sheetId: string) => string;
  reorderSheets: (projectId: string, fromIndex: number, toIndex: number) => void;
  moveSheetToProject: (fromProjectId: string, toProjectId: string, sheetId: string) => void;
  openSheetTab: (sheetId: string) => void;
  closeSheetTab: (sheetId: string) => void;
  reorderOpenTabs: (fromIndex: number, toIndex: number) => void;

  // 컬럼 액션
  addColumn: (projectId: string, sheetId: string, column: Omit<Column, 'id'>) => string;
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
    updates: Partial<Column>
  ) => void;
  deleteColumn: (projectId: string, sheetId: string, columnId: string) => void;
  reorderColumns: (projectId: string, sheetId: string, columnIds: string[]) => void;

  // 행 액션
  addRow: (projectId: string, sheetId: string, cells?: Record<string, CellValue>) => string;
  insertRow: (
    projectId: string,
    sheetId: string,
    atIndex: number,
    cells?: Record<string, CellValue>
  ) => string;
  updateRow: (projectId: string, sheetId: string, rowId: string, updates: Partial<Row>) => void;
  updateCell: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    value: CellValue
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
  deleteRow: (projectId: string, sheetId: string, rowId: string) => void;
  /** 단일 row 를 sheet.rows 안의 새 위치(targetIndex) 로 이동. Kanban 컬럼 내 정렬용. */
  reorderRow: (projectId: string, sheetId: string, rowId: string, targetIndex: number) => void;
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

  // 스티커 액션
  addSticker: (
    projectId: string,
    sheetId: string,
    sticker: Omit<Sticker, 'id' | 'createdAt'>
  ) => string;
  updateSticker: (
    projectId: string,
    sheetId: string,
    stickerId: string,
    updates: Partial<Sticker>
  ) => void;
  deleteSticker: (projectId: string, sheetId: string, stickerId: string) => void;

  // 셀 선택 모드 액션
  startCellSelection: (
    fieldLabel: string,
    callback: (value: number, rowId?: string, columnId?: string) => void
  ) => void;
  completeCellSelection: (value: number, rowId?: string, columnId?: string) => void;
  cancelCellSelection: () => void;

  // 문서 액션 (Phase A — Doc 계층)
  currentDocId: string | null;
  createDoc: (projectId: string, name: string, content?: string) => string;
  updateDoc: (
    projectId: string,
    docId: string,
    updates: Partial<Pick<Doc, 'name' | 'content' | 'icon'>>
  ) => void;
  deleteDoc: (projectId: string, docId: string) => void;
  setCurrentDoc: (docId: string | null) => void;
  openDocTab: (docId: string) => void;
  closeDocTab: (docId: string) => void;

  // 폴더 액션
  createFolder: (projectId: string, name: string, parentId?: string) => string;
  updateFolder: (
    projectId: string,
    folderId: string,
    updates: Partial<Pick<Folder, 'name' | 'color' | 'isExpanded'>>
  ) => void;
  deleteFolder: (projectId: string, folderId: string, deleteContents?: boolean) => void;
  toggleFolderExpanded: (projectId: string, folderId: string) => void;
  moveSheetToFolder: (projectId: string, sheetId: string, folderId: string | null) => void;
  moveFolderToFolder: (projectId: string, folderId: string, parentId: string | null) => void;
  reorderFolders: (
    projectId: string,
    parentId: string | null,
    fromIndex: number,
    toIndex: number
  ) => void;
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
}));

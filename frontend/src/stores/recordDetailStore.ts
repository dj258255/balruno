import { create } from 'zustand';

/**
 * 레코드 상세 패널 전역 상태.
 *
 * 목적: 그리드 뷰 (SheetTable) 에서 어떤 행이든 우측 슬라이드 패널로 열 수 있게.
 * 기존 5개 뷰 (Kanban/Calendar/Form/Gantt/Gallery) 는 각자 로컬 state 로 RecordEditor
 * 를 띄우고 있음 — 그들은 유지. 이 store 는 그리드 뷰 + GlobalRecordDetail 용.
 *
 *  (행↔코멘트 sync) 에서 focused row 추적용으로도 확장 예정.
 */
export interface OpenedRecord {
  projectId: string;
  sheetId: string;
  rowId: string;
}

interface RecordDetailState {
  opened: OpenedRecord | null;
  openRecord: (record: OpenedRecord) => void;
  closeRecord: () => void;
  isOpen: (rowId: string) => boolean;
}

export const useRecordDetail = create<RecordDetailState>((set, get) => ({
  opened: null,
  openRecord: (record) => set({ opened: record }),
  closeRecord: () => set({ opened: null }),
  isOpen: (rowId) => get().opened?.rowId === rowId,
}));

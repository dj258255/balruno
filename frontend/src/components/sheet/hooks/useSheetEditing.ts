import { useState, useCallback, useRef } from 'react';
import type { Sheet, CellValue } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { useHistoryStore } from '@/stores/historyStore';
import { validateCellValue } from '@/lib/validation';
import type { CellPosition } from '../types';
import { parseValue } from '../utils';

interface UseSheetEditingProps {
  projectId: string;
  sheet: Sheet;
  selectedCell: CellPosition | null;
  selectedCells: CellPosition[];
  formulaBarValue: string;
  setFormulaBarValue: (value: string) => void;
  setSelectedCells: (cells: CellPosition[]) => void;
}

export function useSheetEditing({
  projectId,
  sheet,
  selectedCell,
  selectedCells,
  formulaBarValue,
  setFormulaBarValue,
  setSelectedCells,
}: UseSheetEditingProps) {
  const { updateCell, projects, loadProjects } = useProjectStore();
  const { pushState, undo: historyUndo, redo: historyRedo, canUndo, canRedo } = useHistoryStore();

  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isFormulaBarFocused, setIsFormulaBarFocused] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const formulaBarRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  // 셀 편집 시작 — 타입별 전용 인터랙션
  const startEditing = useCallback(
    (rowId: string, columnId: string) => {
      const column = sheet.columns.find((c) => c.id === columnId);
      const row = sheet.rows.find((r) => r.id === rowId);

      if (column?.locked || row?.locked) {
        return;
      }

      // checkbox 는 편집 모드 진입 대신 즉시 토글
      if (column?.type === 'checkbox') {
        const current = row?.cells[columnId];
        const isTrue = current === 'true' || current === 1 || current === '1';
        const next: CellValue = isTrue ? '' : 'true';
        pushState(projects, '체크박스 토글');
        updateCell(projectId, sheet.id, rowId, columnId, next);
        return;
      }

      // rating 은 더블클릭으로 별 하나씩 순환 (0→1→...→max→0)
      if (column?.type === 'rating') {
        const max = column.ratingMax ?? 5;
        const current = row?.cells[columnId];
        const n = typeof current === 'number' ? current : parseFloat(String(current)) || 0;
        const nextN = n >= max ? 0 : Math.floor(n) + 1;
        pushState(projects, '별점 변경');
        updateCell(projectId, sheet.id, rowId, columnId, nextN);
        return;
      }

      // lookup / rollup 은 읽기 전용
      if (column?.type === 'lookup' || column?.type === 'rollup') {
        return;
      }

      setEditingCell({ rowId, columnId });
      const rawValue = row?.cells[columnId];
      const value = rawValue?.toString() || '';
      setEditValue(value);
      setFormulaBarValue(value);
    },
    [sheet.rows, sheet.columns, sheet.id, projectId, updateCell, pushState, projects, setFormulaBarValue]
  );

  // 셀 편집 완료
  const finishEditing = useCallback((valueToSave?: string) => {
    if (!editingCell) return;

    const finalValue = valueToSave !== undefined ? valueToSave : editValue;
    const value = parseValue(finalValue);

    // 유효성 검사
    const column = sheet.columns.find((c) => c.id === editingCell.columnId);
    if (column?.validation && !finalValue.startsWith('=')) {
      const result = validateCellValue(value, column.validation);
      if (!result.isValid) {
        setValidationError(result.error || '잘못된 값입니다');
        setTimeout(() => setValidationError(null), 3000);
      }
    }

    pushState(projects, '셀 편집');
    updateCell(projectId, sheet.id, editingCell.rowId, editingCell.columnId, value);
    setEditingCell(null);
    setEditValue('');
    setShowAutocomplete(false);
    setFormulaBarValue(finalValue);
  }, [editingCell, editValue, projectId, sheet.id, updateCell, sheet.columns, pushState, projects, setFormulaBarValue]);

  // 수식바에서 편집 완료
  const finishFormulaBarEditing = useCallback(() => {
    if (!selectedCell) return;

    const value = parseValue(formulaBarValue);

    pushState(projects, '셀 편집');
    updateCell(projectId, sheet.id, selectedCell.rowId, selectedCell.columnId, value);
    setIsFormulaBarFocused(false);
  }, [selectedCell, formulaBarValue, projectId, sheet.id, updateCell, pushState, projects]);

  // 선택된 셀들에 일괄 값 적용
  const applyBulkEdit = useCallback(() => {
    if (selectedCells.length === 0 || !bulkEditValue.trim()) return;

    const value = parseValue(bulkEditValue);

    for (const cell of selectedCells) {
      updateCell(projectId, sheet.id, cell.rowId, cell.columnId, value);
    }

    setShowBulkEdit(false);
    setBulkEditValue('');
    setSelectedCells([]);
  }, [selectedCells, bulkEditValue, projectId, sheet.id, updateCell, setSelectedCells]);

  // 현재 편집 중인 셀 저장 (x-spreadsheet 패턴)
  const commitCurrentEditingCell = useCallback(() => {
    if (!editingCell || !inputRef.current) return;

    const value = inputRef.current.value;
    const cellToSave = { ...editingCell };
    const finalValue = parseValue(value);

    pushState(projects, '셀 편집');
    updateCell(projectId, sheet.id, cellToSave.rowId, cellToSave.columnId, finalValue);
    setEditingCell(null);
    setEditValue('');
    setShowAutocomplete(false);
  }, [editingCell, pushState, projects, updateCell, projectId, sheet.id]);

  // Undo 핸들러
  const handleUndo = useCallback(() => {
    const previousState = historyUndo();
    if (previousState) {
      loadProjects(previousState);
    }
  }, [historyUndo, loadProjects]);

  // Redo 핸들러
  const handleRedo = useCallback(() => {
    const nextState = historyRedo();
    if (nextState) {
      loadProjects(nextState);
    }
  }, [historyRedo, loadProjects]);

  return {
    // 상태
    editingCell,
    editValue,
    showAutocomplete,
    isFormulaBarFocused,
    showBulkEdit,
    bulkEditValue,
    validationError,

    // refs
    inputRef,
    formulaBarRef,
    isComposingRef,

    // setters
    setEditingCell,
    setEditValue,
    setShowAutocomplete,
    setIsFormulaBarFocused,
    setShowBulkEdit,
    setBulkEditValue,
    setValidationError,

    // 핸들러
    startEditing,
    finishEditing,
    finishFormulaBarEditing,
    applyBulkEdit,
    commitCurrentEditingCell,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  };
}

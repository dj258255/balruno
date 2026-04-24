'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import type { Project } from '@/types';

/**
 * TrackPhase 3 — Y.UndoManager 어댑터 훅.
 *
 * 기존에는 이 훅이 projects 스냅샷을 Zustand 에 setProjects 로 되돌렸지만,
 * 이제 Y.UndoManager 가 Y.Doc 을 직접 되돌리고 observer 가 Zustand 에 반사하므로
 * 이 훅은 단축키 바인딩 + UndoManager 호출만 담당.
 *
 * saveToHistory / prevProjectsRef / isUndoRedoAction 는 과거 API 하위호환을 위해 남김.
 */
export function useProjectHistory() {
  const { undo, redo, canUndo, canRedo, getHistory, jumpTo } = useHistoryStore();
  const isUndoRedoAction = useRef(false);
  const prevProjectsRef = useRef<Project[] | null>(null);

  const handleUndo = useCallback(() => {
    if (!canUndo()) return;
    isUndoRedoAction.current = true;
    undo();
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 100);
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo()) return;
    isUndoRedoAction.current = true;
    redo();
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 100);
  }, [canRedo, redo]);

  const handleHistoryJump = useCallback(
    (index: number, onComplete?: () => void) => {
      isUndoRedoAction.current = true;
      jumpTo(index);
      setTimeout(() => {
        isUndoRedoAction.current = false;
      }, 100);
      onComplete?.();
    },
    [jumpTo]
  );

  /**
   * Phase 3 부터 no-op. Y.UndoManager 가 Y.Doc transaction 을 자동 추적.
   * 과거 호출부 (page.tsx, SheetTable, useSheetEditing 등) 에 남아있는 호출은
   * 점차 제거 예정.
   */
  const saveToHistory = useCallback((_projects: Project[]) => {
    // no-op
  }, []);

  // Keyboard shortcuts — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return {
    handleUndo,
    handleRedo,
    handleHistoryJump,
    canUndo,
    canRedo,
    getHistory,
    saveToHistory,
    isUndoRedoAction,
    prevProjectsRef,
  };
}

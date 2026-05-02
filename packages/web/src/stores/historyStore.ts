/**
 * TrackPhase 3 — Y.UndoManager delegate.
 *
 * 이전에는 매 편집마다 `JSON.parse(JSON.stringify(projects))` 로 스냅샷을 쌓았다.
 * 이제는 활성 프로젝트의 Y.UndoManager 가 CRDT 트랜잭션 단위로 자동 추적하므로
 * 이 스토어는 UndoManager 에 위임하는 얇은 어댑터.
 *
 * 호환성 유지: 기존 call site (pushState / canUndo / getHistory / jumpTo 등) 의
 * 시그니처를 동일하게 노출. pushState / jumpTo / deleteEntry 는 no-op.
 *
 * reactivity: Y.UndoManager 이벤트는 Zustand 밖에서 발생하므로, `tick` 카운터를
 * 올려 Zustand selector 들이 재평가되도록 유도.
 */

import { create } from 'zustand';
import type { Project } from '@/types';
import { useProjectStore } from './projectStore';
import { getUndoManager } from '@/lib/ydoc';

export interface HistoryEntry {
  state: unknown; // 하위호환 필드 (실제로는 사용 안 함)
  label: string;
  timestamp: number;
}

interface HistoryState {
  /** 내부 — UndoManager 이벤트마다 증가. selector 재평가 유도. */
  tick: number;

  /** no-op (Y.UndoManager 자동 추적) — 하위호환. */
  pushState: (projects: Project[], label?: string) => void;

  /** 활성 프로젝트에 undo 적용. Y.Doc 이 되돌아가면 observer 가 Zustand 반사. */
  undo: () => Project[] | null;
  /** 활성 프로젝트에 redo 적용. */
  redo: () => Project[] | null;

  clear: () => void;

  /** Y.UndoManager 는 임의 index 점프를 바로 지원하지 않음. N 회 undo/redo 로 구현. */
  jumpTo: (index: number) => Project[] | null;

  deleteEntry: (type: 'past' | 'future', index: number) => void;

  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistory: () => { past: HistoryEntry[]; future: HistoryEntry[]; currentIndex: number };
}

function getActiveManager() {
  const pid = useProjectStore.getState().currentProjectId;
  if (!pid) return null;
  return getUndoManager(pid);
}

type StackItem = {
  meta: Map<string, unknown>;
};

function stackToEntries(stack: readonly StackItem[]): HistoryEntry[] {
  return stack.map((item) => ({
    state: null,
    label: (item.meta.get('label') as string | undefined) ?? 'common.change',
    timestamp: (item.meta.get('timestamp') as number | undefined) ?? Date.now(),
  }));
}

// 활성 프로젝트 변경 시 리스너 재부착
let subscribedProjectId: string | null = null;

function subscribeActiveManager() {
  const pid = useProjectStore.getState().currentProjectId;
  if (pid === subscribedProjectId) return;
  subscribedProjectId = pid;
  if (!pid) return;

  const um = getUndoManager(pid);
  const onChange = () => {
    useHistoryStore.setState((s) => ({ tick: s.tick + 1 }));
  };
  um.on('stack-item-added', onChange);
  um.on('stack-item-popped', onChange);
  um.on('stack-cleared', onChange);
}

// projectStore 구독 — currentProjectId 변경 시 리스너 재설정.
// 모듈 로드 시 1회만 구독 (HMR 대비 이중 구독 방지는 별도 처리 불필요 — 각 UndoManager
// 는 자신의 destroy 로 리스너가 정리됨).
if (typeof window !== 'undefined') {
  useProjectStore.subscribe((state, prev) => {
    if (state.currentProjectId !== prev.currentProjectId) {
      subscribeActiveManager();
    }
  });
  queueMicrotask(subscribeActiveManager);
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  tick: 0,

  pushState: () => {
    // no-op: Y.UndoManager 가 Y.Doc 의 transaction 을 자동 추적
  },

  undo: () => {
    const um = getActiveManager();
    if (!um || !um.canUndo()) return null;
    um.undo();
    return null;
  },

  redo: () => {
    const um = getActiveManager();
    if (!um || !um.canRedo()) return null;
    um.redo();
    return null;
  },

  clear: () => {
    getActiveManager()?.clear();
  },

  jumpTo: (index: number) => {
    const um = getActiveManager();
    if (!um) return null;
    const pastLen = um.undoStack.length;
    const totalLen = pastLen + um.redoStack.length;
    if (index < 0 || index >= totalLen) return null;

    const currentIdx = pastLen - 1;
    const delta = index - currentIdx;
    if (delta === 0) return null;

    if (delta < 0) {
      for (let i = 0; i < -delta; i++) um.undo();
    } else {
      for (let i = 0; i < delta; i++) um.redo();
    }
    return null;
  },

  deleteEntry: () => {
    // Y.UndoManager 는 임의 stack item 삭제 미지원.
    // HistoryPanel UI 에서 호출되지만 Phase 3 에선 no-op — 추후 StackItem 필터로 재구현 가능.
  },

  canUndo: () => {
    void get().tick; // tick 의존 — selector 재평가 트리거
    return getActiveManager()?.canUndo() ?? false;
  },

  canRedo: () => {
    void get().tick;
    return getActiveManager()?.canRedo() ?? false;
  },

  getHistory: () => {
    void get().tick;
    const um = getActiveManager();
    if (!um) return { past: [], future: [], currentIndex: -1 };
    const past = stackToEntries(um.undoStack);
    const future = stackToEntries(um.redoStack);
    return { past, future, currentIndex: past.length - 1 };
  },
}));

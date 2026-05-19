/**
 * Doc actions slice — direct setState (post v0.6 cleanup).
 *
 * 문서(GDD · 설계안)의 CRUD. 이전엔 Y.Doc 경유 + observer 가 zustand 반사
 * 했지만, ADR 0008 §10 stage α 에서 cellSlice 와 동일하게 *직접 setState*
 * 패턴으로 전환. doc tree 변경(create/rename/move/delete)은 사이드바의
 * 기존 호출자가 그대로 store action 을 부르고, 우리는 local set 으로 즉시
 * 반영하면서 동시에 'balruno:tree-*' CustomEvent 를 dispatch — WorkspaceShell
 * 의 makeTreeHandlers('DOC') listener 가 그 이벤트를 받아 tree.* op 를 sync
 * bridge 로 흘려보낸다. 같은 패턴을 sheet 트리도 사용 (treeMutationSlice).
 *
 * 즉 사이드바 → store action → optimistic set + emitTree → docTreeOps → op
 * → backend doc_tree column. ServerDocView 는 *본문* 만 yjs/Hocuspocus 로
 * sync 하고 트리 메타 (이름, parent, position) 는 이 path 로 흐른다.
 */

import { newId } from '@/lib/uuid';
import type { StoreApi } from 'zustand';
import type { Doc } from '@/types';
import type { ProjectState, TabEntry } from '../projectStore';

function emitTreeAdd(parentId: string | null, position: number, node: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('balruno:tree-add', {
      detail: { kind: 'DOC', parentId, position, node },
    }),
  );
}
function emitTreeDelete(nodeId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('balruno:tree-delete', { detail: { kind: 'DOC', nodeId } }),
  );
}
function emitTreeRename(
  nodeId: string,
  patch: { newName?: string; newIcon?: string },
): void {
  if (typeof window === 'undefined') return;
  if (patch.newName === undefined && patch.newIcon === undefined) return;
  window.dispatchEvent(
    new CustomEvent('balruno:tree-rename', {
      detail: { kind: 'DOC', nodeId, ...patch },
    }),
  );
}
function emitTreeMove(nodeId: string, newParentId: string | null, newPosition: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('balruno:tree-move', {
      detail: { kind: 'DOC', nodeId, newParentId, newPosition },
    }),
  );
}

type SetFn = StoreApi<ProjectState>['setState'];

/** Lightweight read-only access to project state — wired from projectStore at module init. */
const useProjectStoreGetters: { getProject: (projectId: string) => { docs?: Doc[] } | undefined } = {
  getProject: () => undefined,
};
export function bindDocSliceGetters(getProject: (projectId: string) => { docs?: Doc[] } | undefined) {
  useProjectStoreGetters.getProject = getProject;
}

/** Recursive walk of the doc tree to find every descendant of a node (excluding the node itself). */
function collectDescendantDocIds(allDocs: Doc[], rootId: string): string[] {
  const out: string[] = [];
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    for (const d of allDocs) {
      if (d.parentId === parent) {
        out.push(d.id);
        queue.push(d.id);
      }
    }
  }
  return out;
}

// --- Tab 유틸 (sheetSlice 와 동일 로직, 재정의) ---
const hasTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string) =>
  tabs.some((t) => t.kind === kind && t.id === id);

const withTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  hasTab(tabs, kind, id) ? tabs : [...tabs, { kind, id }];

const withoutTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  tabs.filter((t) => !(t.kind === kind && t.id === id));

const nextActiveAfterClose = (tabs: TabEntry[]): TabEntry | null => {
  return tabs.length > 0 ? tabs[tabs.length - 1] : null;
};

export const createDocActions = (set: SetFn) => ({
  createDoc: (
    projectId: string,
    name: string,
    content?: string,
    options?: { parentId?: string },
  ): string => {
    const id = newId();
    const now = Date.now();
    const newDoc: Doc = {
      id,
      name,
      // Icon is undefined by default — the tree renderer falls back to
      // the lucide FileText icon. Users can override via the emoji
      // picker. Storing undefined keeps the default rendering
      // consistent with the lucide-first policy.
      icon: undefined,
      content: content ?? '',
      parentId: options?.parentId,
      isExpanded: true,
      position: now, // 시간 기반 단조 증가 → 같은 부모 안에서 끝에 추가
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id !== projectId ? p : { ...p, docs: [...(p.docs ?? []), newDoc] },
      ),
      currentDocId: id,
      currentSheetId: null,
      openTabs: withTab(state.openTabs, 'doc', id),
    }));
    // Mirror into the doc_tree on the backend. WorkspaceShell's
    // docTreeOps listener picks this up and emits a tree.add op so
    // the new doc survives reload + becomes visible to peers. Icon
    // is part of the node so the page-facing emoji travels with the
    // doc — shared TreeNode just gained the optional field.
    emitTreeAdd(
      newDoc.parentId ?? null,
      Number.MAX_SAFE_INTEGER, // append; insertNodeAt clamps
      { id, type: 'doc', name, icon: newDoc.icon },
    );
    return id;
  },

  updateDoc: (
    projectId: string,
    docId: string,
    updates: Partial<Pick<Doc, 'name' | 'content' | 'icon' | 'parentId' | 'isExpanded' | 'position'>>
  ) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id !== projectId
          ? p
          : {
              ...p,
              docs: (p.docs ?? []).map((d) =>
                d.id !== docId ? d : { ...d, ...updates, updatedAt: Date.now() },
              ),
            },
      ),
    }));
    // Tree-level meta lives in doc_tree (name + icon + position).
    // tree.rename op (extended 2026-05-10) carries both newName and
    // newIcon as optional patches — we emit only the keys that
    // actually changed. content/isExpanded are local-only / yjs-routed.
    const patch: { newName?: string; newIcon?: string } = {};
    if (typeof updates.name === 'string' && updates.name.trim()) {
      patch.newName = updates.name.trim();
    }
    if ('icon' in updates) {
      // undefined / '' = clear the icon (picker reset to default).
      patch.newIcon = updates.icon ?? '';
    }
    if (patch.newName !== undefined || patch.newIcon !== undefined) {
      emitTreeRename(docId, patch);
    }
  },

  deleteDoc: (projectId: string, docId: string) => {
    // Cascade: gather all descendants first so we can close their tabs too.
    const project = useProjectStoreGetters.getProject(projectId);
    const descendants = collectDescendantDocIds(project?.docs ?? [], docId);
    const allIds = new Set<string>([docId, ...descendants]);

    set((state) => {
      let newTabs = state.openTabs;
      for (const id of allIds) newTabs = withoutTab(newTabs, 'doc', id);
      const projects = state.projects.map((p) =>
        p.id !== projectId
          ? p
          : { ...p, docs: (p.docs ?? []).filter((d) => !allIds.has(d.id)) },
      );
      if (!allIds.has(state.currentDocId ?? '')) {
        return { projects, openTabs: newTabs };
      }
      const next = nextActiveAfterClose(newTabs);
      return {
        projects,
        openTabs: newTabs,
        currentDocId: next?.kind === 'doc' ? next.id : null,
        currentSheetId: next?.kind === 'sheet' ? next.id : null,
      };
    });
    // Backend cascade: deleting a parent in the doc_tree wipes its
    // descendants on the server side too, so a single tree.delete on
    // the root id is enough — no need to emit per descendant.
    emitTreeDelete(docId);
  },

  /** 부모 변경 — 트리 안에서 다른 위치로 이동. parentId === undefined 면 루트로. */
  moveDoc: (projectId: string, docId: string, parentId: string | undefined, position?: number) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id !== projectId
          ? p
          : {
              ...p,
              docs: (p.docs ?? []).map((d) =>
                d.id !== docId
                  ? d
                  : {
                      ...d,
                      parentId,
                      ...(position !== undefined ? { position } : {}),
                      updatedAt: Date.now(),
                    },
              ),
            },
      ),
    }));
    emitTreeMove(
      docId,
      parentId ?? null,
      position ?? Number.MAX_SAFE_INTEGER,
    );
  },

  /**
   * 사이드바 펼침/접힘 토글. Per-user preference — Outline / Obsidian
   * / VS Code Explorer 패턴으로 sidebarPrefs (localStorage) 에만
   * 저장한다. 같은 워크스페이스의 다른 멤버, 그리고 같은 사용자의
   * 다른 기기는 각자 자기 펼침 상태를 가진다 (Notion / Linear 처럼
   * server-side 까지 가지 않는 의도된 trade-off).
   *
   * 기존 Doc.isExpanded 필드도 일관성을 위해 같이 mirror 하지만,
   * persist 가 sidebarPrefs 쪽이라 reload 시 source of truth 는 그쪽.
   */
  toggleDocExpanded: (projectId: string, docId: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id !== projectId
          ? p
          : {
              ...p,
              docs: (p.docs ?? []).map((d) =>
                d.id !== docId ? d : { ...d, isExpanded: !d.isExpanded },
              ),
            },
      ),
    }));
    // Mirror to the persisted preference store. Lazy import keeps the
    // slice's module load free of UI-store side effects.
    void import('../sidebarPrefsStore').then(({ useSidebarPrefs }) => {
      useSidebarPrefs.getState().toggleDocExpanded(docId);
    });
  },

  /** 문서 선택 — null 이면 단순 해제. id 면 탭 자동 열림 + 시트 해제. */
  setCurrentDoc: (docId: string | null) => {
    if (!docId) {
      set({ currentDocId: null });
      return;
    }
    set((state) => ({
      currentDocId: docId,
      currentSheetId: null,
      openTabs: withTab(state.openTabs, 'doc', docId),
    }));
  },

  openDocTab: (docId: string) => {
    set((state) => ({
      openTabs: withTab(state.openTabs, 'doc', docId),
      currentDocId: docId,
      currentSheetId: null,
    }));
  },

  closeDocTab: (docId: string) => {
    set((state) => {
      const newTabs = withoutTab(state.openTabs, 'doc', docId);
      if (state.currentDocId !== docId) {
        return { openTabs: newTabs };
      }
      const next = nextActiveAfterClose(newTabs);
      return {
        openTabs: newTabs,
        currentDocId: next?.kind === 'doc' ? next.id : null,
        currentSheetId: next?.kind === 'sheet' ? next.id : null,
      };
    });
  },
});

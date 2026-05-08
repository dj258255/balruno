'use client';

/**
 * Project detail page (/w/[slug]/p/[projectSlug]).
 *
 * The minimum viable bridge between the server-canonical workspace UI
 * and the project sync infrastructure (ADR 0017). Mounting this page
 * is what triggers the first {@code /ws/projects/{id}} WebSocket
 * connect and the {@code sync.full} hydrate frame; before this route
 * landed, the entire sync stack (Hocuspocus + Spring WS handler +
 * useProjectSync hook) was reachable only through tests / curl probes,
 * never through a real browser session.
 *
 * Slug → id resolution mirrors the /w/[slug] page: list the caller's
 * workspaces + projects and filter client-side. Same privacy posture
 * (not-a-member ≡ not-existing).
 *
 * The full sheet / doc editing UI from local mode (SheetTable, view
 * switcher, etc.) lives in {@code app/page.tsx} and depends on the
 * Y.Doc + IndexedDB store. Wiring it into the server-canonical flow
 * is a separate phase — that work has to bridge zustand + the doc
 * tree from sync.full + per-cell write paths into useProjectSync.
 * This page intentionally renders only the connection-status + a
 * placeholder so each phase ships behind a green CI run.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Menu, MessageSquare } from 'lucide-react';

import {
  BackendError,
  importTemplate,
  listProjects,
  listWorkspaces,
  type CatalogGroupSummary,
  type Project,
  type Workspace,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectHistory } from '@/hooks';
import { useProjectSyncBridge } from '@/hooks/useProjectSyncBridge';
import { useAuthStore } from '@/stores/authStore';
import { setActiveStack, pushUndo, hydrateStack, type UndoableOp, type UndoEntry } from '@/lib/undo/undoStack';
import type { UndoMeta } from '@/hooks/useProjectSync';
import { getClientSessionId } from '@/lib/undo/sessionId';
import { nextActionGroupId } from '@/lib/undo/actionGroup';
import { fetchUndoStack } from '@/lib/backend/undo';
import {
  renameNodeInTree,
  removeNodeFromTree,
  moveNodeInTree,
  isDescendant,
  locateNodeParent,
  findNodeInTree,
} from '@/lib/tree';
import { ConnectionStatus } from '@/components/sync/ConnectionStatus';
import { CellCommentPanel } from '@/components/comments/CellCommentPanel';
import { DocCommentPanel } from '@/components/comments/DocCommentPanel';
import { InboxBell } from '@/components/comments/InboxBell';
import { ServerDocView } from '@/components/docs/ServerDocView';
import { ServerSheetTree } from '@/components/sheet/ServerSheetTree';
import SheetTable from '@/components/sheet/SheetTable';
import KanbanView from '@/components/views/KanbanView';
import CalendarView from '@/components/views/CalendarView';
import GanttView from '@/components/views/GanttView';
import FormView from '@/components/views/FormView';
import GalleryView from '@/components/views/GalleryView';
import { BalanceHeatmap } from '@/components/views/BalanceHeatmap';
import { CurveOverlay } from '@/components/views/CurveOverlay';
import { ProbabilityTree } from '@/components/views/ProbabilityTree';
import { SheetDiffView } from '@/components/views/SheetDiffView';
import ViewSwitcher from '@/components/views/ViewSwitcher';
import { TemplateImportModal } from '@/components/sheet/TemplateImportModal';
import { useCommentSelectionStore } from '@/stores/commentSelectionStore';
import type { CommentSelection } from '@/stores/commentSelectionStore';
import type { Sheet } from '@balruno/shared';
import { emitOp } from '@/lib/sync/writeQueue';
import { newId } from '@/lib/uuid';
import type { TreeNode } from '@balruno/shared';

/**
 * Walk the sheet_tree (recursive folder/sheet structure) and rename
 * the node with the matching id. Returns a new array (immutable
 * setState semantics); unaffected branches keep the same reference
 * so React subtrees don't churn.
 */
/**
 * Build the cell-label string shown in CellCommentPanel's header —
 * "{sheetName} · Row {n} · {columnName}". Best-effort lookup; an
 * unknown id falls through to a short hex of the UUID so the panel
 * still has something to render.
 */
function cellLabelFor(sel: CommentSelection, sheets: Sheet[]): string {
  if (!sel || sel.kind !== 'sheet-cell') return '';
  const sheet = sheets.find((s) => s.id === sel.sheetId);
  if (!sheet) return sel.rowId.slice(0, 8);
  const rowIdx = sheet.rows.findIndex((r) => r.id === sel.rowId);
  const column = sheet.columns.find((c) => c.id === sel.columnId);
  const colName = column?.name ?? sel.columnId.slice(0, 8);
  return `${sheet.name} · Row ${rowIdx + 1} · ${colName}`;
}

/** DFS the tree for a node id, return its name (or null). */
function findNodeName(tree: TreeNode[], nodeId: string): string | null {
  for (const node of tree) {
    if (node.id === nodeId) return node.name;
    if (node.children && node.children.length > 0) {
      const found = findNodeName(node.children, nodeId);
      if (found !== null) return found;
    }
  }
  return null;
}

// Tree mutators live in /lib/tree — same helpers used by the wss
// broadcast handler + applyUndoableOps for tree.* undo (ADR 0021
// phase 3).

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string; projectSlug: string }>();
  const router = useRouter();
  const slug = params?.slug;
  const projectSlug = params?.projectSlug;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !projectSlug) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listWorkspaces();
        if (cancelled) return;
        const ws = list.find((w) => w.slug === slug);
        if (!ws) {
          setError('not-found');
          setLoading(false);
          return;
        }
        setWorkspace(ws);
        const ps = await listProjects(ws.id);
        if (cancelled) return;
        const p = ps.find((proj) => proj.slug === projectSlug);
        if (!p) {
          setError('not-found');
          setLoading(false);
          return;
        }
        setProject(p);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof BackendError && e.isUnauthenticated) {
          useBackendAuthStore.getState().clear();
          router.replace('/login');
          return;
        }
        setError(e instanceof Error ? e.message : '프로젝트를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, projectSlug, router]);

  // Seed project metadata into the store as soon as the resolve
  // effect populates `project`. sync.full will replace .sheets
  // wholesale on arrival (Stage E.1's hydrateProjectFromSyncFull),
  // so seeding metadata first means the broadcast apply path always
  // has a project to attach to. The find guard makes the seed
  // idempotent against re-runs.
  useEffect(() => {
    if (!project) return;
    useProjectStore.setState((state) => {
      if (state.projects.find((p) => p.id === project.id)) return state;
      const now = Date.now();
      return {
        projects: [
          ...state.projects,
          {
            id: project.id,
            name: project.name,
            // backend Project.description is string | null, store
            // Project.description is string | undefined (optional);
            // coerce so the shape matches.
            description: project.description ?? undefined,
            sheets: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    });
  }, [project]);

  // Bridge stays idle while projectId is unknown; once the resolve
  // effect populates `project`, useProjectSyncBridge opens
  // /ws/projects/{id}, registers the live sender on the writeQueue,
  // and forwards sync.full / op.acked / broadcast frames into the
  // per-region baseVersions (ADR 0018 Stage B).
  const { status: syncStatus } = useProjectSyncBridge({
    projectId: project?.id ?? null,
    enabled: Boolean(project),
  });

  // Activate the per-(user, project) undo stack at mount; clear on
  // unmount so peer sessions / project switches start fresh.
  // ADR 0021 — historyStore reads from this same module.
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useEffect(() => {
    if (!project?.id || !userId) return;
    setActiveStack(userId, project.id);
    return () => setActiveStack(null, null);
  }, [project?.id, userId]);

  // Hydrate the local stack from server (ADR 0021 v2.3 Phase 5.E) —
  // restores Cmd+Z across page refreshes within the 120-min Baserow
  // window. Per-tab scoped via X-Client-Session-Id (sent inside
  // fetchUndoStack), so opening a fresh tab still gets a clean
  // history rather than picking up another tab's actions.
  useEffect(() => {
    if (!project?.id || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const entries = await fetchUndoStack(project.id);
        if (cancelled) return;
        // Server returns newest first; we want oldest at the bottom
        // of the stack (Cmd+Z pops the latest). hydrateStack pushes
        // in array order, so reverse to get oldest-first.
        const past: UndoEntry[] = [];
        const future: UndoEntry[] = [];
        for (let i = entries.length - 1; i >= 0; i--) {
          const e = entries[i];
          if (!e.forward || !e.inverse) continue;
          const entry: UndoEntry = {
            label: 'Server hydrated',
            forward: e.forward as UndoableOp[],
            inverse: e.inverse as UndoableOp[],
            timestamp: new Date(e.createdAt).getTime(),
          };
          if (e.undone) future.push(entry); else past.push(entry);
        }
        hydrateStack(userId, project.id, past, future);
      } catch {
        // Hydrate is best-effort. Silent failure leaves the local
        // stack empty; the user just doesn't get cross-refresh
        // Cmd+Z, but the rest of the page works.
      }
    })();
    return () => { cancelled = true; };
  }, [project?.id, userId]);

  // Bind Cmd+Z / Cmd+Shift+Z. The hook reads canUndo / canRedo
  // from historyStore which delegates to the active undo stack.
  useProjectHistory();

  // Read the live sheet from the store — populated by hydrate from
  // sync.full. Falls back to undefined while the WS handshake races
  // with the resolve effect.
  const localProject = useProjectStore((state) =>
    project ? state.projects.find((p) => p.id === project.id) : undefined,
  );
  const sheets = localProject?.sheets ?? [];
  const sheetTree = localProject?.sheetTree ?? [];
  const docTree = localProject?.docTree ?? [];

  // Selection is polymorphic — at most one of {sheet leaf, doc leaf}
  // is active. Keep a discriminated union so the main panel knows
  // whether to render the SheetTable or the doc editor placeholder.
  //
  // Default selection (first sheet) is computed *during render* from
  // the live sheets array — no effect-driven setState. Invalidation
  // is handled by the same derive: if the explicit selection points
  // at an id that no longer exists (peer deleted the sheet, doc
  // moved out of view, etc.) we fall through to the first sheet.
  type Selection = { kind: 'sheet' | 'doc'; id: string } | null;
  const [explicitSelection, setExplicitSelection] = useState<Selection>(null);
  const explicitStillValid =
    explicitSelection &&
    (explicitSelection.kind === 'sheet'
      ? sheets.some((s) => s.id === explicitSelection.id)
      : findNodeName(docTree, explicitSelection.id) !== null);
  const selection: Selection =
    (explicitStillValid ? explicitSelection : null) ??
    (sheets[0] ? { kind: 'sheet', id: sheets[0].id } : null);
  const setSelection = setExplicitSelection;

  const selectedSheet =
    selection?.kind === 'sheet'
      ? sheets.find((s) => s.id === selection.id)
      : undefined;
  const selectedSheetId = selection?.kind === 'sheet' ? selection.id : null;
  const selectedDocId = selection?.kind === 'doc' ? selection.id : null;
  // Selected doc's title from the tree leaf — falls back to a
  // generic label while the broadcast for a freshly-added doc races
  // the user's leaf-click. ServerDocView only needs this for its
  // header; the body lives entirely in the Y.Doc.
  const selectedDocTitle = selectedDocId ? findNodeName(docTree, selectedDocId) ?? '제목 없음' : '';

  // Tree handlers are identical between sheet_tree and doc_tree
  // regions — only the treeKind on the emit and the Project field
  // they mutate differ. Build them via a factory so the doc handlers
  // stay in lockstep with the sheet handlers automatically. Direct
  // setState on the store (Y.Doc bypass) + writeQueue.emitOp so peers
  // pick up the change via the matching broadcast. ADR 0018 paired
  // pattern.
  // Push a tree.* undo entry into the per-project stack. Bound at
  // makeTreeHandlers time so each handler can call `pushTreeUndo`
  // with just (label, forward, inverse). Anonymous / pre-auth users
  // (no userId) drop the push silently — same defensive shape as
  // cellSlice's undo helpers.
  const pushTreeUndo = (
    label: string,
    forward: UndoableOp[],
    inverse: UndoableOp[],
  ): UndoMeta | null => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId || !project) return null;
    pushUndo(userId, project.id, {
      label,
      forward,
      inverse,
      timestamp: Date.now(),
    });
    // Pattern C wire metadata (ADR 0021 v2.3 Phase 5) — same shape
    // as cellSlice's metaOf helper. Local stack already pushed; this
    // is the parallel server-side persistence envelope.
    return {
      forward,
      inverse,
      actionGroupId: nextActionGroupId(),
      clientSessionId: getClientSessionId(),
    };
  };

  const makeTreeHandlers = (treeKind: 'SHEET' | 'DOC') => {
    const treeField: 'sheetTree' | 'docTree' =
      treeKind === 'SHEET' ? 'sheetTree' : 'docTree';
    const setTree = (mutator: (tree: TreeNode[]) => TreeNode[]) => {
      if (!project) return;
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) =>
          p.id !== project.id
            ? p
            : { ...p, [treeField]: mutator(p[treeField] ?? []) },
        ),
      }));
    };

    return {
      rename: (nodeId: string, newName: string) => {
        const current = localProject?.[treeField] ?? [];
        const node = findNodeInTree(current, nodeId);
        const oldName = node?.name ?? '';
        setTree((tree) => renameNodeInTree(tree, nodeId, newName));
        const renameMeta = node && oldName !== newName
          ? pushTreeUndo(
              'Tree rename',
              [{ type: 'tree.rename', treeKind, nodeId, newName, baseVersion: 0, clientMsgId: '' }],
              [{ type: 'tree.rename', treeKind, nodeId, newName: oldName, baseVersion: 0, clientMsgId: '' }],
            )
          : null;
        emitOp({ kind: 'tree.rename', treeKind, nodeId, newName }, renameMeta);
      },
      addFolder: () => {
        if (!project) return;
        const newFolder: TreeNode = {
          id: newId(),
          type: 'folder',
          name: '새 폴더',
          children: [],
        };
        const position = (localProject?.[treeField]?.length ?? 0);
        setTree((tree) => [...tree, newFolder]);
        const addFolderMeta = pushTreeUndo(
          'Tree add',
          [{ type: 'tree.add', treeKind, parentId: null, position, node: newFolder, baseVersion: 0, clientMsgId: '' }],
          [{ type: 'tree.delete', treeKind, nodeId: newFolder.id, baseVersion: 0, clientMsgId: '' }],
        );
        emitOp({
          kind: 'tree.add',
          treeKind,
          parentId: null,
          position,
          node: newFolder,
        }, addFolderMeta);
      },
      addLeaf: () => {
        if (!project) return;
        const leafId = newId();
        const leafType: 'sheet' | 'doc' = treeKind === 'SHEET' ? 'sheet' : 'doc';
        const newLeaf: TreeNode = {
          id: leafId,
          type: leafType,
          name: leafType === 'sheet' ? '새 시트' : '새 문서',
        };
        const position = (localProject?.[treeField]?.length ?? 0);
        setTree((tree) => [...tree, newLeaf]);
        const addLeafMeta = pushTreeUndo(
          'Tree add',
          [{ type: 'tree.add', treeKind, parentId: null, position, node: newLeaf, baseVersion: 0, clientMsgId: '' }],
          [{ type: 'tree.delete', treeKind, nodeId: leafId, baseVersion: 0, clientMsgId: '' }],
        );
        emitOp({
          kind: 'tree.add',
          treeKind,
          parentId: null,
          position,
          node: newLeaf,
        }, addLeafMeta);
        setSelection({ kind: leafType, id: leafId });
      },
      deleteNode: (nodeId: string) => {
        const current = localProject?.[treeField] ?? [];
        const node = findNodeInTree(current, nodeId);
        const located = locateNodeParent(current, nodeId);
        setTree((tree) => removeNodeFromTree(tree, nodeId));
        // Inverse needs the full subtree + its original parent /
        // position so we can re-insert it. If the node wasn't
        // present before deletion (peer race) skip the push —
        // there's nothing meaningful to restore.
        const deleteMeta = node && located
          ? pushTreeUndo(
              'Tree delete',
              [{ type: 'tree.delete', treeKind, nodeId, baseVersion: 0, clientMsgId: '' }],
              [{
                type: 'tree.add',
                treeKind,
                parentId: located.parent,
                position: located.index,
                node,
                baseVersion: 0,
                clientMsgId: '',
              }],
            )
          : null;
        emitOp({ kind: 'tree.delete', treeKind, nodeId }, deleteMeta);
      },
      move: (nodeId: string, newParentId: string | null, newPosition: number) => {
        const current = localProject?.[treeField] ?? [];
        // Cycle guard: dropping into self/descendant would orphan
        // the subtree. Root drop (null parent) is always safe.
        if (newParentId !== null && isDescendant(current, nodeId, newParentId)) return;
        // Snapshot original location for the inverse op.
        const located = locateNodeParent(current, nodeId);
        setTree((tree) => moveNodeInTree(tree, nodeId, newParentId, newPosition));
        const moveMeta = located
            && (located.parent !== newParentId || located.index !== newPosition)
          ? pushTreeUndo(
              'Tree move',
              [{ type: 'tree.move', treeKind, nodeId, newParentId, newPosition, baseVersion: 0, clientMsgId: '' }],
              [{
                type: 'tree.move',
                treeKind,
                nodeId,
                newParentId: located.parent,
                newPosition: located.index,
                baseVersion: 0,
                clientMsgId: '',
              }],
            )
          : null;
        emitOp({
          kind: 'tree.move',
          treeKind,
          nodeId,
          newParentId,
          newPosition,
        }, moveMeta);
      },
    };
  };

  const sheetTreeOps = makeTreeHandlers('SHEET');
  const docTreeOps = makeTreeHandlers('DOC');

  // Stage F — "Add from template" modal state. Backend mutates +
  // broadcasts sync.full so we don't predict / mutate the local
  // store here; just hand off to importTemplate and the bridge
  // handles the re-hydrate.
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Comment side panel — open/close + active selection. SheetTable's
  // selectedCell effect mirrors the cell into the same store.
  const commentPanelOpen = useCommentSelectionStore((s) => s.panelOpen);
  const setCommentPanelOpen = useCommentSelectionStore((s) => s.setPanelOpen);
  const commentSelection = useCommentSelectionStore((s) => s.selection);
  const setCommentSelection = useCommentSelectionStore((s) => s.setSelection);

  // Mirror the active doc into commentSelection so DocCommentPanel
  // can render comments scoped to the current document. SheetTable's
  // own effect handles the sheet-cell case; this effect covers
  // doc-body. When neither a sheet-cell nor a doc is active the
  // selection is left as-is (sheet selection persists across a brief
  // tree click flicker that way).
  useEffect(() => {
    if (selection?.kind === 'doc' && selection.id) {
      setCommentSelection({ kind: 'doc-body', documentId: selection.id });
    }
  }, [selection, setCommentSelection]);

  // Mobile sidebar drawer state — desktop (md+) ignores this and
  // renders the sidebar inline. ADR 0022 stage A.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Close the drawer once the user picks something inside (sheet
  // leaf, doc leaf) so they don't have to manually dismiss.
  const closeMobileSidebar = () => setMobileSidebarOpen(false);
  const handlePickTemplate = async (group: CatalogGroupSummary) => {
    if (!project) return;
    await importTemplate(project.id, group.id);
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </main>
    );
  }

  if (error === 'not-found' || !workspace || !project) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <button
          onClick={() => router.push(slug ? `/w/${slug}` : '/workspaces')}
          className="mb-4 inline-flex items-center gap-1 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 워크스페이스
        </button>
        <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          프로젝트를 찾을 수 없습니다
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          이 슬러그의 프로젝트가 없거나 멤버가 아닙니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger — opens the sidebar drawer. md:hidden
              keeps it off desktop (sidebar inline there). */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-[var(--bg-hover)] md:hidden"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="시트 사이드바 열기"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => router.push(`/w/${workspace.slug}`)}
            className="inline-flex items-center gap-1 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {workspace.name}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setCommentPanelOpen(!commentPanelOpen)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 max-md:min-h-11 max-md:px-3 hover:bg-[var(--bg-hover)]"
            style={{
              color: commentPanelOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: commentPanelOpen ? 'var(--bg-hover)' : undefined,
            }}
            title="코멘트 패널 토글"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            코멘트
          </button>
          <InboxBell />
          <span style={{ color: 'var(--text-secondary)' }}>동기화:</span>
          <ConnectionStatus />
          <code className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {syncStatus}
          </code>
        </div>
      </div>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {project.name}
        </h1>
        <p className="mt-1 text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
          /{project.slug}
        </p>
        {error && error !== 'not-found' && (
          <p className="mt-2 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </header>

      {sheets.length > 0 ? (
        <div
          className="md:grid md:gap-4"
          style={{
            gridTemplateColumns: commentPanelOpen ? '260px 1fr 320px' : '260px 1fr',
          }}
        >
          {/* Mobile drawer backdrop — clicks outside the sidebar
              dismiss the drawer. Hidden on desktop. */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              onClick={closeMobileSidebar}
              aria-hidden="true"
            />
          )}

          {/* Sidebar — sheet_tree navigation (ADR 0020 Stage D minimal).
              Desktop: grid column. Mobile: fixed off-canvas drawer
              that slides in via translateX (ADR 0022 stage A). */}
          <aside
            className={
              'rounded-lg border p-2 transition-transform '
              + 'md:static md:translate-x-0 md:w-auto '
              + 'fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto '
              + (mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full')
            }
            style={{
              borderColor: 'var(--border-primary)',
              background: 'var(--bg-primary)',
              minHeight: '400px',
            }}
          >
            <h2
              className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide"
              style={{ color: 'var(--text-tertiary)' }}
            >
              시트
            </h2>
            <ServerSheetTree
              tree={sheetTree}
              leafKind="sheet"
              selectedSheetId={selectedSheetId}
              onSelectSheet={(id) => {
                setSelection({ kind: 'sheet', id });
                closeMobileSidebar();
              }}
              onRenameNode={sheetTreeOps.rename}
              onAddFolder={sheetTreeOps.addFolder}
              onAddSheet={sheetTreeOps.addLeaf}
              onAddFromTemplate={() => setTemplateModalOpen(true)}
              onDeleteFolder={sheetTreeOps.deleteNode}
              onMoveNode={sheetTreeOps.move}
            />

            <h2
              className="mt-4 px-2 py-1.5 text-xs font-medium uppercase tracking-wide"
              style={{ color: 'var(--text-tertiary)' }}
            >
              문서
            </h2>
            <ServerSheetTree
              tree={docTree}
              leafKind="doc"
              selectedSheetId={selectedDocId}
              onSelectSheet={(id) => {
                setSelection({ kind: 'doc', id });
                closeMobileSidebar();
              }}
              onRenameNode={docTreeOps.rename}
              onAddFolder={docTreeOps.addFolder}
              onAddSheet={docTreeOps.addLeaf}
              onDeleteFolder={docTreeOps.deleteNode}
              onMoveNode={docTreeOps.move}
            />
          </aside>

          {/* Main — SheetTable for sheet selection, doc placeholder
              for doc selection (real Tiptap editor wiring lands in a
              follow-up phase — needs server-canonical version of
              updateDoc / setCurrentDoc + HocuspocusProvider mount). */}
          <section
            className="rounded-lg border overflow-hidden"
            style={{
              borderColor: 'var(--border-primary)',
              background: 'var(--bg-primary)',
              minHeight: '500px',
            }}
          >
            {selection?.kind === 'sheet' && selectedSheet ? (
              <div className="flex h-full flex-col">
                <ViewSwitcher projectId={project.id} sheet={selectedSheet} />
                {selectedSheet.activeView === 'kanban' ? (
                  <KanbanView projectId={project.id} sheet={selectedSheet} />
                ) : selectedSheet.activeView === 'calendar' ? (
                  <CalendarView projectId={project.id} sheet={selectedSheet} />
                ) : selectedSheet.activeView === 'gantt' ? (
                  <GanttView projectId={project.id} sheet={selectedSheet} />
                ) : selectedSheet.activeView === 'form' ? (
                  <FormView projectId={project.id} sheet={selectedSheet} />
                ) : selectedSheet.activeView === 'gallery' ? (
                  <GalleryView projectId={project.id} sheet={selectedSheet} />
                ) : selectedSheet.activeView === 'heatmap' ? (
                  <BalanceHeatmap sheetId={selectedSheet.id} />
                ) : selectedSheet.activeView === 'curve' ? (
                  <CurveOverlay sheetId={selectedSheet.id} />
                ) : selectedSheet.activeView === 'probability' ? (
                  <ProbabilityTree sheetId={selectedSheet.id} />
                ) : selectedSheet.activeView === 'diff' ? (
                  // Diff view compares two project snapshots — server-
                  // canonical mode doesn't keep historical snapshots in
                  // memory, so without a "compare against" picker the
                  // view renders its empty-baseline placeholder. Picker
                  // (compare to op_idempotency reversible window) is a
                  // follow-up.
                  <SheetDiffView sheetId={selectedSheet.id} before={null} after={null} />
                ) : (
                  <SheetTable projectId={project.id} sheet={selectedSheet} />
                )}
              </div>
            ) : selection?.kind === 'doc' && selectedDocId ? (
              <ServerDocView
                documentId={selectedDocId}
                projectId={project.id}
                title={selectedDocTitle}
                onTitleChange={(next) => docTreeOps.rename(selectedDocId, next)}
              />
            ) : (
              <p className="p-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                시트나 문서를 선택하세요.
              </p>
            )}
          </section>

          {/* Comment side panel — opens on commentPanelOpen toggle.
              Reads the active cell from commentSelectionStore, which
              SheetTable's selectedCell effect keeps in sync. */}
          {commentPanelOpen && commentSelection?.kind === 'sheet-cell' && (
            <CellCommentPanel
              projectId={project.id}
              sheetId={commentSelection.sheetId}
              rowId={commentSelection.rowId}
              columnId={commentSelection.columnId}
              cellLabel={cellLabelFor(commentSelection, sheets)}
              onClose={() => setCommentPanelOpen(false)}
            />
          )}
          {commentPanelOpen && commentSelection?.kind === 'doc-body' && (
            <DocCommentPanel
              projectId={project.id}
              documentId={commentSelection.documentId}
              docTitle={selectedDocTitle || '문서'}
              anchorPosition={commentSelection.anchorPosition}
              anchorLength={commentSelection.anchorLength}
              onClose={() => setCommentPanelOpen(false)}
            />
          )}
          {commentPanelOpen
            && commentSelection?.kind !== 'sheet-cell'
            && commentSelection?.kind !== 'doc-body' && (
            <aside
              className="rounded-lg border p-4 text-sm"
              style={{
                borderColor: 'var(--border-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-tertiary)',
              }}
            >
              코멘트를 달 셀이나 문서를 먼저 선택하세요.
            </aside>
          )}
        </div>
      ) : (
        <section
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
        >
          <p style={{ color: 'var(--text-tertiary)' }}>
            <code>sync.full</code> 응답을 기다리는 중...
          </p>
        </section>
      )}

      <TemplateImportModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onPick={handlePickTemplate}
      />
    </main>
  );
}

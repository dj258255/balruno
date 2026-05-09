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

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Menu } from 'lucide-react';

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
import { usePanelStates } from '@/hooks/usePanelStates';
import BottomDock from '@/components/BottomDock';
import DockedToolbox from '@/components/DockedToolbox';
import WorkspaceSettingsClient from '@/app/components/WorkspaceSettingsClient';
import AccountSettingsClient from '@/app/components/AccountSettingsClient';
import NotificationSettingsClient from '@/app/components/NotificationSettingsClient';
import CreateWorkspaceModal from '@/app/components/CreateWorkspaceModal';
import TemplateGalleryModal from '@/app/components/TemplateGalleryModal';
import Sidebar from '@/components/layout/Sidebar';
import SheetTabs from '@/components/layout/SheetTabs';
import SidebarResizer from '@/app/components/SidebarResizer';
import { useToolLayoutStore } from '@/stores/toolLayoutStore';
import StickerLayer from '@/components/sheet/StickerLayer';
import { PmBadgeStrip } from '@/components/sheet/PmBadgeStrip';
import SheetHeader from '@/app/components/SheetHeader';
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
import ServerDiffView from '@/components/views/ServerDiffView';
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

/**
 * Reusable workspace + project shell. Both the bare `/w/{ws}` route
 * (workspace home — picks the most-recently-visited project) and the
 * explicit `/w/{ws}/p/{p}` route (deep link) mount this component
 * with different inputs:
 *
 *   - workspaceSlug — always required
 *   - initialProjectSlug — null = resolve last visited (or first
 *     project in workspace); string = exact slug
 *
 * The Linear-style `/{ws}` and `/{ws}/projects/{p}` routes also mount
 * this same shell. Phase 1 of the URL migration adds those new
 * routes; this shell is the single source of truth for the rendering.
 */
export interface WorkspaceShellProps {
  workspaceSlug: string;
  initialProjectSlug: string | null;
}

export default function WorkspaceShell({
  workspaceSlug,
  initialProjectSlug,
}: WorkspaceShellProps) {
  const slug = workspaceSlug;
  const projectSlug = initialProjectSlug;
  const router = useRouter();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
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

        // Project resolution:
        //   - explicit projectSlug from URL  → exact match
        //   - null (workspace-level URL)     → last visited (localStorage hint),
        //                                      else most-recently-updated, else first.
        let p: Project | undefined;
        if (projectSlug) {
          p = ps.find((proj) => proj.slug === projectSlug);
        } else if (ps.length > 0) {
          if (typeof window !== 'undefined') {
            const lastSlug = window.localStorage.getItem(`balruno:lastProject:${ws.slug}`);
            const lastMatch = lastSlug ? ps.find((pr) => pr.slug === lastSlug) : null;
            if (lastMatch) p = lastMatch;
          }
          if (!p) {
            p = ps.reduce(
              (best, pr) =>
                new Date(pr.updatedAt).getTime() > new Date(best.updatedAt).getTime()
                  ? pr
                  : best,
              ps[0],
            );
          }
        }

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

  // Persist the last-visited (workspace, project) pair so the root
  // / page can direct-jump back here next session instead of
  // bouncing through /workspaces and /w/[slug]. Linear / Notion /
  // Figma pattern. Writes are cheap; the read paths skip the hop
  // when both keys are populated.
  useEffect(() => {
    if (!workspace || !project || typeof window === 'undefined') return;
    window.localStorage.setItem('balruno:lastWorkspace', workspace.slug);
    window.localStorage.setItem(`balruno:lastProject:${workspace.slug}`, project.slug);
  }, [workspace, project]);

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

  // Bridge for legacy store mutations re-wired in treeMutationSlice.
  // Sidebar drag-drop on sheets / folders dispatches a CustomEvent
  // ('balruno:tree-move') with { kind, nodeId, newParentId, newPosition };
  // we forward it to the matching sheetTreeOps/docTreeOps.move so a
  // single tree.move op is emitted + broadcast through the sync bridge.
  useEffect(() => {
    const handler = (raw: Event) => {
      const e = raw as CustomEvent<{
        kind: 'SHEET' | 'DOC';
        nodeId: string;
        newParentId: string | null;
        newPosition: number;
      }>;
      const d = e.detail;
      if (!d) return;
      const ops = d.kind === 'DOC' ? docTreeOps : sheetTreeOps;
      ops.move(d.nodeId, d.newParentId, d.newPosition);
    };
    window.addEventListener('balruno:tree-move', handler);
    return () => window.removeEventListener('balruno:tree-move', handler);
  }, [sheetTreeOps, docTreeOps]);

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

  // Floating dock — restored from v0.5 home page (commit eda7fe3^).
  // BottomDock + DockedToolbox share `panels` state via usePanelStates;
  // each tool button toggles a DraggablePanel mounted by DockedToolbox.
  // Server-canonical reads/writes go through the same useProjectStore
  // path the inline sheet table uses, so no extra rewiring needed.
  const { panels: toolPanels } = usePanelStates();

  // Container ref for the StickerLayer — sticky notes are positioned
  // relative to this rect (v0.5 behaviour). Currently a no-op render
  // until the sticker JSONB column lands (see StickerLayer placeholder).
  const sheetContainerRef = useRef<HTMLDivElement>(null);

  // v0.5 Sidebar tool-toggle callbacks — pass-through to the
  // floating dock's DraggablePanel state so the side rail and
  // bottom dock both control the same panels.
  const toggleTool = (id: keyof typeof toolPanels) => () =>
    toolPanels[id].setShow(!toolPanels[id].show);
  // Settings modals — Notion/Linear-style centered overlays
  // triggered from the workspace switcher menu. Replace the
  // standalone /{wsSlug}/settings + /settings/account routes.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const sidebarCallbacks = {
    onShowChart: toggleTool('chart'),
    onShowHelp: () => { /* OnboardingGuide not yet rewired */ },
    onShowCalculator: toggleTool('calculator'),
    onShowComparison: toggleTool('comparison'),
    onShowReferences: () => { /* ReferencesModal not yet rewired */ },
    onShowSettings: () => setSettingsOpen(true),
    onShowAccountSettings: () => setAccountOpen(true),
    onShowNotificationSettings: () => setNotificationsOpen(true),
    onShowCreateWorkspace: () => setCreateWorkspaceOpen(true),
    onShowPresetComparison: toggleTool('preset'),
    onShowImbalanceDetector: toggleTool('imbalance'),
    onShowGoalSolver: toggleTool('goal'),
    onShowBalanceAnalysis: toggleTool('balance'),
    onShowEconomy: toggleTool('economy'),
    onShowDpsVariance: toggleTool('dpsVariance'),
    onShowCurveFitting: toggleTool('curveFitting'),
    onToggleFormulaHelper: toggleTool('formulaHelper'),
    onToggleBalanceValidator: toggleTool('balanceValidator'),
    onToggleDifficultyCurve: toggleTool('difficultyCurve'),
    onToggleSimulation: toggleTool('simulation'),
    onToggleEntityDefinition: toggleTool('entityDefinition'),
  };
  const activeTools = {
    calculator: toolPanels.calculator.show,
    comparison: toolPanels.comparison.show,
    chart: toolPanels.chart.show,
    presetComparison: toolPanels.preset.show,
    imbalanceDetector: toolPanels.imbalance.show,
    goalSolver: toolPanels.goal.show,
    balanceAnalysis: toolPanels.balance.show,
    economy: toolPanels.economy.show,
    dpsVariance: toolPanels.dpsVariance.show,
    curveFitting: toolPanels.curveFitting.show,
    formulaHelper: toolPanels.formulaHelper.show,
    balanceValidator: toolPanels.balanceValidator.show,
    difficultyCurve: toolPanels.difficultyCurve.show,
    simulation: toolPanels.simulation.show,
    entityDefinition: toolPanels.entityDefinition.show,
  };
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
          onClick={() => router.push(slug ? `/${slug}` : '/workspaces')}
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
    <main
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Mobile-only hamburger — desktop has the sidebar inline so
          the workspace breadcrumb / sync chrome lives inside the
          SidebarFooter instead of a separate topbar (v0.5 parity). */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded shadow"
        style={{
          color: 'var(--text-secondary)',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
        aria-label="시트 사이드바 열기"
      >
        <Menu className="h-5 w-5" />
      </button>

      {error && error !== 'not-found' && (
        <p className="flex-shrink-0 m-2 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {sheets.length > 0 ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile drawer backdrop — clicks outside the sidebar
              dismiss the drawer. Hidden on desktop. */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              onClick={closeMobileSidebar}
              aria-hidden="true"
            />
          )}

          {/* Sidebar — v0.5 layout restored (Phase E). Renders the
              workspace switcher, project list, sheet/doc tree, pinned
              section, quick-access today's work bucket, and footer.
              Mutating actions (createSheet, deleteProject, etc.) hit
              the legacyStubSlice alert until D-3 / E-4 follow-up
              re-wires them to the project-tree REST. The non-mutating
              tool toggles (calculator/balance/etc.) are wired here
              and feed the same DockedToolbox panel state.

              Mobile: still uses translateX off-canvas pattern (ADR 0022
              stage A) — Sidebar.tsx itself is desktop-positioned, so
              we wrap it for the drawer behaviour. */}
          <SidebarBoundary open={mobileSidebarOpen}>
            <Sidebar {...sidebarCallbacks} activeTools={activeTools} />
          </SidebarBoundary>
          <SidebarResizer />

          {/* Main column — SheetTabs strip on top, sheet/doc view
              filling the rest. The flex column ensures the strip
              stays pinned and the view scrolls inside its own box. */}
          <section
            className="flex-1 flex flex-col min-w-0 overflow-hidden"
            style={{ background: 'var(--bg-primary)' }}
          >
            {/* v0.5 SheetTabs at the top of the main area — restored
                from eda7fe3^ project layout. Lets the user switch
                between open sheets/docs without going back to the
                sidebar. Reads from the store-resolved project (which
                carries the v0.5 sheets[]/docs[] arrays via
                useProjectSyncBridge.sync.full); the REST `project`
                from /api/v1/projects/:id has only the metadata.
                Mutations (close-tab, reorder) hit the
                legacyStubSlice alert pending E-4 follow-up. */}
            {localProject ? <SheetTabs project={localProject} /> : null}
            {selection?.kind === 'sheet' && selectedSheet ? (
              <div
                ref={sheetContainerRef}
                className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 pb-[140px] min-h-0 overflow-hidden relative"
              >
                <StickerLayer containerRef={sheetContainerRef} />
                <SheetHeader sheet={selectedSheet} />
                <PmBadgeStrip sheet={selectedSheet} />
                <ViewSwitcher projectId={project.id} sheet={selectedSheet} />
                <div className="flex-1 min-h-0 overflow-hidden">
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
                    // ServerDiffView walks op_idempotency.inverse_payload
                    // backward from the current project to synthesise a
                    // "before" snapshot inside the 120-min reversible
                    // window (ADR 0021 v3.0 Phase 5). Picker chooses
                    // how far back. Per-tab + per-user scope (Baserow
                    // pattern) — solo dev sees their own edit history.
                    <ServerDiffView projectId={project.id} sheetId={selectedSheet.id} />
                  ) : (
                    <SheetTable projectId={project.id} sheet={selectedSheet} />
                  )}
                </div>
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
              className="md:w-[320px] md:flex-shrink-0 md:h-full md:overflow-y-auto border-l p-4 text-sm"
              style={{
                borderColor: 'var(--border-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-tertiary)',
              }}
            >
              코멘트를 달 셀이나 문서를 먼저 선택하세요.
            </aside>
          )}

          {/* DockedToolbox — right-side panel drawer that opens the
              clicked tool from the BottomDock. Must be a flex
              sibling of the main section so it lays out as the
              right column on desktop (v0.5 parity); when mounted
              outside the body flex it floats over the bottom of
              the screen instead, which is the regression the user
              flagged. */}
          <DockedToolbox panels={toolPanels} />
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

      {/* BottomDock — fixed-position toggle bar floating at the
          screen bottom. Stays at the <main> level so it doesn't
          fight the body flex. */}
      <BottomDock panels={toolPanels} isModalOpen={templateModalOpen} />

      {/* Settings modals (Notion/Linear pattern). Mounted at <main>
          level so they portal to document.body regardless of where
          the user triggered them from. */}
      {settingsOpen && workspace && (
        <WorkspaceSettingsClient
          workspaceSlug={workspace.slug}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {accountOpen && (
        <AccountSettingsClient onClose={() => setAccountOpen(false)} />
      )}
      {notificationsOpen && (
        <NotificationSettingsClient onClose={() => setNotificationsOpen(false)} />
      )}
      {createWorkspaceOpen && (
        <CreateWorkspaceModal onClose={() => setCreateWorkspaceOpen(false)} />
      )}
      {workspace && (
        <TemplateGalleryModal
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
        />
      )}
    </main>
  );
}

/**
 * Sidebar wrapper that owns the boundary between the sidebar and
 * the main column. The Sidebar component itself stays at a locked
 * 280px inner width so its layout never reflows; this wrapper takes
 * the user's resizer drag (toolLayoutStore.sidebarWidth, min 280)
 * and adds any extra space as right padding. Dragging the resizer
 * widens the sidebar's *visible area* (more empty space alongside
 * the inner content) without restructuring the inner items, which
 * is the behaviour the user asked for.
 */
function SidebarBoundary({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const stored = useToolLayoutStore((s) => s.sidebarWidth);
  const width = Math.max(280, stored || 280);
  return (
    <div
      className={
        'relative transition-transform '
        + 'md:static md:translate-x-0 md:flex-shrink-0 md:h-full '
        + 'fixed inset-y-0 left-0 z-40 overflow-hidden '
        + (open ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
      }
      style={{
        width: `${width}px`,
        background: 'var(--bg-primary)',
      }}
    >
      {children}
    </div>
  );
}

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
import { ArrowLeft, Loader2 } from 'lucide-react';

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
import { useProjectSyncBridge } from '@/hooks/useProjectSyncBridge';
import { ConnectionStatus } from '@/components/sync/ConnectionStatus';
import { ServerDocView } from '@/components/docs/ServerDocView';
import { ServerSheetTree } from '@/components/sheet/ServerSheetTree';
import SheetTable from '@/components/sheet/SheetTable';
import { TemplateImportModal } from '@/components/sheet/TemplateImportModal';
import { emitOp } from '@/lib/sync/writeQueue';
import { newId } from '@/lib/uuid';
import type { TreeNode } from '@balruno/shared';

/**
 * Walk the sheet_tree (recursive folder/sheet structure) and rename
 * the node with the matching id. Returns a new array (immutable
 * setState semantics); unaffected branches keep the same reference
 * so React subtrees don't churn.
 */
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

function renameNodeInTree(tree: TreeNode[], nodeId: string, newName: string): TreeNode[] {
  return tree.map((node) => {
    if (node.id === nodeId) return { ...node, name: newName };
    if (node.children && node.children.length > 0) {
      const renamedChildren = renameNodeInTree(node.children, nodeId, newName);
      if (renamedChildren !== node.children) {
        return { ...node, children: renamedChildren };
      }
    }
    return node;
  });
}

/**
 * Find a node in the tree (DFS). Returns null if not found. Used by
 * moveNodeInTree to extract the dragged subtree before re-insertion,
 * and by isDescendant to block cycles (folder dropped into itself).
 */
function findNodeInTree(tree: TreeNode[], nodeId: string): TreeNode | null {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeInTree(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Returns true if `candidateAncestorId` is the ancestor of (or equal
 * to) `nodeId` in the given tree. Used to block dropping a folder
 * into its own descendant — that would orphan the dragged subtree
 * because removing it from its old parent would also remove its new
 * parent (which is inside it). Standard tree-DnD cycle guard.
 */
function isDescendant(tree: TreeNode[], candidateAncestorId: string, nodeId: string): boolean {
  if (candidateAncestorId === nodeId) return true;
  const ancestor = findNodeInTree(tree, candidateAncestorId);
  if (!ancestor) return false;
  return findNodeInTree(ancestor.children ?? [], nodeId) !== null;
}

/**
 * Locate a node's current parent + sibling index. parent === null
 * means the node lives at root. Returns null when the id is missing
 * (caller treats as no-op). Used by moveNodeInTree to detect same-
 * parent reorder + decide off-by-one adjustment.
 */
function locateNodeParent(
  tree: TreeNode[],
  nodeId: string,
  parent: string | null = null,
): { parent: string | null; index: number } | null {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    if (node.id === nodeId) return { parent, index: i };
    if (node.children && node.children.length > 0) {
      const found = locateNodeParent(node.children, nodeId, node.id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Move a node within the sheet_tree: remove it from its current
 * parent, then insert it under newParentId at newPosition. Returns
 * a new array (immutable setState), or the same reference if the
 * move is a no-op / illegal (cycle).
 *
 * Three design points (all applied):
 *
 *  1. Cycle guard — drop into self/descendant short-circuits to the
 *     same reference. Both outbound (handleMoveNode) and inbound
 *     (broadcast apply) call this helper, so receivers stay safe
 *     even if their local state momentarily diverges before another
 *     op lands.
 *
 *  2. Off-by-one — when source and target share a parent and source
 *     index is *less than* the drop position, removing source first
 *     shifts every later sibling left by 1, so the visual drop slot
 *     is now at position-1. Without this adjustment the node lands
 *     one slot past where the user pointed (Notion/VSCode/dnd-kit
 *     all apply this correction).
 *
 *  3. No-op echo — when sender receives its own broadcast, the tree
 *     is already in the target state. extract+reinsert would yield
 *     the same content but fresh array references, causing the
 *     sidebar to re-render. Detect via locateNodeParent and bail.
 */
function moveNodeInTree(
  tree: TreeNode[],
  nodeId: string,
  newParentId: string | null,
  newPosition: number,
): TreeNode[] {
  if (newParentId !== null && isDescendant(tree, nodeId, newParentId)) return tree;
  const subtree = findNodeInTree(tree, nodeId);
  if (!subtree) return tree;

  const located = locateNodeParent(tree, nodeId);
  if (!located) return tree;
  const { parent: currentParent, index: currentIndex } = located;

  if (currentParent === newParentId && currentIndex === newPosition) return tree;

  const without = removeNodeFromTree(tree, nodeId);
  const adjusted =
    currentParent === newParentId && currentIndex < newPosition
      ? newPosition - 1
      : newPosition;
  return insertNodeAt(without, newParentId, adjusted, subtree);
}

/** Insert a subtree into the tree at parentId/position. parentId=null
 *  means root level. Returns new array. */
function insertNodeAt(
  tree: TreeNode[],
  newParentId: string | null,
  position: number,
  subtree: TreeNode,
): TreeNode[] {
  if (newParentId === null) {
    const next = tree.slice();
    next.splice(Math.max(0, Math.min(position, next.length)), 0, subtree);
    return next;
  }
  return tree.map((node) => {
    if (node.id === newParentId) {
      const children = node.children ? node.children.slice() : [];
      children.splice(Math.max(0, Math.min(position, children.length)), 0, subtree);
      return { ...node, children };
    }
    if (node.children && node.children.length > 0) {
      const inserted = insertNodeAt(node.children, newParentId, position, subtree);
      if (inserted !== node.children) {
        return { ...node, children: inserted };
      }
    }
    return node;
  });
}

/** Remove the node with the given id and its descendants. Returns a
 *  new array if anything changed, the same reference otherwise. */
function removeNodeFromTree(tree: TreeNode[], nodeId: string): TreeNode[] {
  const next: TreeNode[] = [];
  let changed = false;
  for (const node of tree) {
    if (node.id === nodeId) {
      changed = true;
      continue;
    }
    if (node.children && node.children.length > 0) {
      const filtered = removeNodeFromTree(node.children, nodeId);
      if (filtered !== node.children) {
        next.push({ ...node, children: filtered });
        changed = true;
        continue;
      }
    }
    next.push(node);
  }
  return changed ? next : tree;
}

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
        setTree((tree) => renameNodeInTree(tree, nodeId, newName));
        emitOp({ kind: 'tree.rename', treeKind, nodeId, newName });
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
        emitOp({
          kind: 'tree.add',
          treeKind,
          parentId: null,
          position,
          node: newFolder,
        });
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
        emitOp({
          kind: 'tree.add',
          treeKind,
          parentId: null,
          position,
          node: newLeaf,
        });
        setSelection({ kind: leafType, id: leafId });
      },
      deleteNode: (nodeId: string) => {
        setTree((tree) => removeNodeFromTree(tree, nodeId));
        emitOp({ kind: 'tree.delete', treeKind, nodeId });
      },
      move: (nodeId: string, newParentId: string | null, newPosition: number) => {
        const current = localProject?.[treeField] ?? [];
        // Cycle guard: dropping into self/descendant would orphan
        // the subtree. Root drop (null parent) is always safe.
        if (newParentId !== null && isDescendant(current, nodeId, newParentId)) return;
        setTree((tree) => moveNodeInTree(tree, nodeId, newParentId, newPosition));
        emitOp({
          kind: 'tree.move',
          treeKind,
          nodeId,
          newParentId,
          newPosition,
        });
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
        <button
          onClick={() => router.push(`/w/${workspace.slug}`)}
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {workspace.name}
        </button>
        <div className="flex items-center gap-2 text-xs">
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
          className="grid gap-4"
          style={{ gridTemplateColumns: '260px 1fr' }}
        >
          {/* Sidebar — sheet_tree navigation (ADR 0020 Stage D minimal) */}
          <aside
            className="rounded-lg border p-2"
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
              onSelectSheet={(id) => setSelection({ kind: 'sheet', id })}
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
              onSelectSheet={(id) => setSelection({ kind: 'doc', id })}
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
              <SheetTable projectId={project.id} sheet={selectedSheet} />
            ) : selection?.kind === 'doc' && selectedDocId ? (
              <ServerDocView
                documentId={selectedDocId}
                title={selectedDocTitle}
                onTitleChange={(next) => docTreeOps.rename(selectedDocId, next)}
              />
            ) : (
              <p className="p-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                시트나 문서를 선택하세요.
              </p>
            )}
          </section>
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

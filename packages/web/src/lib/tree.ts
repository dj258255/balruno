/**
 * Pure tree mutators shared between the project page (outbound
 * handlers) and applyUndoableOps (undo replay). Earlier the same
 * helpers existed in three places: page.tsx (local handlers),
 * useProjectSyncBridge.ts (peer-broadcast applies, with an "echo
 * dedup" guard on insert), and the never-used legacy local mode.
 *
 * Extracting them lets ADR 0021 phase 3 (tree.* undo) reuse the
 * same shape applyUndoableOps already follows for cell ops:
 * direct setState + emitOp.
 *
 * Conventions:
 *   - Mutators return a NEW tree array if anything changed, the
 *     SAME reference otherwise. setState gets short-circuited when
 *     the reference is unchanged, avoiding spurious re-renders on
 *     idempotent ops (a peer echoing back our own broadcast).
 *   - Inserts always clamp position to [0, len]. Negative or
 *     out-of-bounds indices land at the nearest end without
 *     throwing — peer state may briefly disagree on a parent's
 *     child count after a deletion races with an insert.
 *   - moveNodeInTree carries a same-parent off-by-one correction
 *     (Notion / VSCode / dnd-kit convention) so the visual drop
 *     slot matches where the user pointed.
 */

import type { Folder, Project, TreeNode } from '@/types';

/**
 * Derive the flat Folder[] the sidebar renders from, plus a
 * sheetId → enclosing-folderId map, by walking a sheet_tree. The
 * sidebar (ProjectList / FolderItem) reads project.folders +
 * sheet.folderId, but creation only writes the nested sheetTree —
 * so folders never appeared and moved sheets never re-parented.
 * This is the adapter: sheetTree is the single source of truth,
 * folders[] + folderId are projected from it on every write.
 *
 * isExpanded is PRESERVED from prevFolders by id (default true when
 * a folder is newly seen) so a user's expand/collapse survives the
 * re-derivation that follows the next tree write. createdAt /
 * updatedAt likewise carry over (0 when unknown — the sheetTree node
 * doesn't persist timestamps).
 */
function deriveFolders(
  tree: TreeNode[],
  prevFolders?: Folder[],
): { folders: Folder[]; sheetFolder: Map<string, string> } {
  const prevById = new Map<string, Folder>();
  for (const f of prevFolders ?? []) prevById.set(f.id, f);
  const folders: Folder[] = [];
  const sheetFolder = new Map<string, string>();
  const walk = (nodes: TreeNode[], parentId: string | undefined): void => {
    for (const node of nodes) {
      if (node.type === 'folder') {
        const prev = prevById.get(node.id);
        folders.push({
          id: node.id,
          name: node.name,
          parentId,
          isExpanded: prev?.isExpanded ?? true,
          createdAt: prev?.createdAt ?? 0,
          updatedAt: prev?.updatedAt ?? 0,
        });
        if (node.children && node.children.length > 0) walk(node.children, node.id);
      } else if (node.type === 'sheet') {
        if (parentId) sheetFolder.set(node.id, parentId);
      }
    }
  };
  walk(tree, undefined);
  return { folders, sheetFolder };
}

/**
 * Project the sidebar-facing flat arrays off the canonical
 * sheetTree. Returns a new Project with:
 *   - folders   = every folder node in sheetTree (isExpanded
 *                 preserved from the incoming project.folders)
 *   - sheets    = same array, each sheet's folderId re-stamped to
 *                 its enclosing folder id (undefined at root)
 *
 * Sheet references are preserved when folderId is unchanged so
 * React subtrees don't churn on unrelated tree writes.
 */
export function withDerivedFolders(project: Project): Project {
  const { folders, sheetFolder } = deriveFolders(
    project.sheetTree ?? [],
    project.folders,
  );
  return {
    ...project,
    folders,
    sheets: project.sheets.map((s) => {
      const folderId = sheetFolder.get(s.id);
      return s.folderId === folderId ? s : { ...s, folderId };
    }),
  };
}

/** Find a node by id (DFS). Returns null when missing. */
export function findNodeInTree(tree: TreeNode[], nodeId: string): TreeNode | null {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeInTree(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/** True if `candidateAncestorId` is an ancestor of (or equal to)
 *  `nodeId` in the tree. Used to block dropping a folder into its
 *  own descendant (would orphan the dragged subtree). */
export function isDescendant(
  tree: TreeNode[],
  candidateAncestorId: string,
  nodeId: string,
): boolean {
  if (candidateAncestorId === nodeId) return true;
  const ancestor = findNodeInTree(tree, candidateAncestorId);
  if (!ancestor) return false;
  return findNodeInTree(ancestor.children ?? [], nodeId) !== null;
}

/** Locate a node's current parent + sibling index. parent = null
 *  means the node lives at root. Returns null when the id is
 *  missing. Used by moveNodeInTree (no-op detect + same-parent
 *  off-by-one). */
export function locateNodeParent(
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

/** True when `nodeId` exists anywhere in the tree. Used as the
 *  echo dedup guard on insertNodeAt — a peer broadcast for a node
 *  the sender already inserted should be a no-op, not a duplicate. */
export function containsNodeId(tree: TreeNode[], nodeId: string): boolean {
  return findNodeInTree(tree, nodeId) !== null;
}

/** Rename in place. Returns the same reference if nothing matched. */
export function renameNodeInTree(
  tree: TreeNode[],
  nodeId: string,
  newName: string,
): TreeNode[] {
  let changed = false;
  const next = tree.map((node) => {
    if (node.id === nodeId) {
      changed = true;
      return { ...node, name: newName };
    }
    if (node.children && node.children.length > 0) {
      const renamedChildren = renameNodeInTree(node.children, nodeId, newName);
      if (renamedChildren !== node.children) {
        changed = true;
        return { ...node, children: renamedChildren };
      }
    }
    return node;
  });
  return changed ? next : tree;
}

/** Remove the node + descendants. Returns the same reference if
 *  the id wasn't found. */
export function removeNodeFromTree(tree: TreeNode[], nodeId: string): TreeNode[] {
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

/** Insert a subtree at parentId / position. parentId = null means
 *  root. Idempotent: if the subtree's id is already present, the
 *  same reference is returned (peer broadcast echo dedup). */
export function insertNodeAt(
  tree: TreeNode[],
  parentId: string | null,
  position: number,
  subtree: TreeNode,
): TreeNode[] {
  if (containsNodeId(tree, subtree.id)) return tree;
  if (parentId === null) {
    const next = tree.slice();
    const clamped = Math.max(0, Math.min(position, next.length));
    next.splice(clamped, 0, subtree);
    return next;
  }
  return tree.map((node) => {
    if (node.id === parentId) {
      const children = node.children ? node.children.slice() : [];
      const clamped = Math.max(0, Math.min(position, children.length));
      children.splice(clamped, 0, subtree);
      return { ...node, children };
    }
    if (node.children && node.children.length > 0) {
      const inserted = insertNodeAt(node.children, parentId, position, subtree);
      if (inserted !== node.children) return { ...node, children: inserted };
    }
    return node;
  });
}

/** Move a node within the tree: extract from current parent, then
 *  re-insert under newParentId at newPosition. The `Raw` variant
 *  skips the same-parent off-by-one — use it when the caller has
 *  a *canonical* position (server broadcast apply, undo replay).
 *  The non-Raw `moveNodeInTree` is for outbound page handlers
 *  where newPosition is the user's visual drop slot. */
export function moveNodeInTreeRaw(
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
  if (located.parent === newParentId && located.index === newPosition) return tree;

  const without = removeNodeFromTree(tree, nodeId);
  return insertNodeAt(without, newParentId, newPosition, subtree);
}

/** Outbound move from a page handler. newPosition is the user's
 *  visual drop slot — when source is in the same parent and
 *  earlier than the drop slot, removing source first shifts every
 *  later sibling left by 1, so the visual slot is now position-1
 *  (Notion / VSCode / dnd-kit convention). */
export function moveNodeInTree(
  tree: TreeNode[],
  nodeId: string,
  newParentId: string | null,
  newPosition: number,
): TreeNode[] {
  const located = locateNodeParent(tree, nodeId);
  if (!located) return moveNodeInTreeRaw(tree, nodeId, newParentId, newPosition);
  const adjusted =
    located.parent === newParentId && located.index < newPosition
      ? newPosition - 1
      : newPosition;
  return moveNodeInTreeRaw(tree, nodeId, newParentId, adjusted);
}

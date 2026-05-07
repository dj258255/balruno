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

import type { TreeNode } from '@/types';

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
 *  re-insert under newParentId at newPosition. Cycle guard +
 *  same-parent off-by-one + no-op echo as documented above. */
export function moveNodeInTree(
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
  // insertNodeAt's containsNodeId guard would no-op the
  // re-insertion (subtree was just removed, but its id existed in
  // the tree we passed). Use the without-tree instead so the guard
  // sees the absent id.
  return insertNodeAt(without, newParentId, adjusted, subtree);
}

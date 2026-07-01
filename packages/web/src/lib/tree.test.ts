// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';

import {
  containsNodeId,
  findNodeInTree,
  insertNodeAt,
  isDescendant,
  locateNodeParent,
  moveNodeInTree,
  moveNodeInTreeRaw,
  removeNodeFromTree,
  renameNodeInTree,
  withDerivedFolders,
} from './tree';
import type { Project, Sheet, TreeNode } from '@/types';

const leaf = (id: string, name = id): TreeNode => ({ id, type: 'sheet', name });
const folder = (id: string, children: TreeNode[] = []): TreeNode =>
  ({ id, type: 'folder', name: id, children });

describe('renameNodeInTree', () => {
  it('renames a top-level node and returns new array', () => {
    const tree = [leaf('a'), leaf('b')];
    const next = renameNodeInTree(tree, 'a', 'A');
    expect(next).not.toBe(tree);
    expect(next[0].name).toBe('A');
    expect(next[1].name).toBe('b');
  });

  it('descends into folders to find the target', () => {
    const tree = [folder('f', [leaf('child')])];
    const next = renameNodeInTree(tree, 'child', 'CHILD');
    expect((next[0].children ?? [])[0].name).toBe('CHILD');
  });

  it('returns the same reference when no node matched (idempotent echo)', () => {
    const tree = [leaf('a')];
    const next = renameNodeInTree(tree, 'missing', 'whatever');
    expect(next).toBe(tree);
  });
});

describe('removeNodeFromTree', () => {
  it('removes a top-level node and returns new array', () => {
    const tree = [leaf('a'), leaf('b')];
    const next = removeNodeFromTree(tree, 'a');
    expect(next).not.toBe(tree);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('b');
  });

  it('removes a nested node + leaves siblings', () => {
    const tree = [folder('f', [leaf('a'), leaf('b')])];
    const next = removeNodeFromTree(tree, 'a');
    expect((next[0].children ?? [])).toEqual([leaf('b')]);
  });

  it('returns same reference when id not present', () => {
    const tree = [leaf('a')];
    expect(removeNodeFromTree(tree, 'missing')).toBe(tree);
  });
});

describe('insertNodeAt', () => {
  it('appends to root when parentId null', () => {
    const tree = [leaf('a')];
    const next = insertNodeAt(tree, null, 1, leaf('b'));
    expect(next.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('clamps position to [0, len] on root insert', () => {
    const tree = [leaf('a')];
    const next = insertNodeAt(tree, null, 99, leaf('b'));
    expect(next.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('inserts under a parent folder', () => {
    const tree = [folder('f', [leaf('a')])];
    const next = insertNodeAt(tree, 'f', 0, leaf('b'));
    expect((next[0].children ?? []).map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('idempotent: id already present → same reference (echo dedup)', () => {
    const tree = [leaf('a')];
    const next = insertNodeAt(tree, null, 1, leaf('a'));
    expect(next).toBe(tree);
  });
});

describe('moveNodeInTreeRaw (canonical position)', () => {
  it('moves a node to a new parent without off-by-one', () => {
    const tree = [folder('src', [leaf('a')]), folder('dst', [leaf('x')])];
    const next = moveNodeInTreeRaw(tree, 'a', 'dst', 1);
    expect((next[1].children ?? []).map((n) => n.id)).toEqual(['x', 'a']);
    expect((next[0].children ?? [])).toEqual([]);
  });

  it('blocks move into self/descendant', () => {
    const tree = [folder('parent', [folder('child', [])])];
    const next = moveNodeInTreeRaw(tree, 'parent', 'child', 0);
    expect(next).toBe(tree);
  });

  it('no-op when position + parent already match', () => {
    const tree = [leaf('a'), leaf('b')];
    const next = moveNodeInTreeRaw(tree, 'a', null, 0);
    expect(next).toBe(tree);
  });
});

describe('moveNodeInTree (visual drop slot)', () => {
  it('applies same-parent off-by-one when source < target', () => {
    // tree: [a, b, c, d]. User drags a to position 3 (drop slot
    // after c). After remove, tree is [b, c, d] (3 items). Insert
    // at adjusted=2 yields [b, c, a, d]. Visual: a is now in slot
    // 3 (between c and d) — correct.
    const tree = [leaf('a'), leaf('b'), leaf('c'), leaf('d')];
    const next = moveNodeInTree(tree, 'a', null, 3);
    expect(next.map((n) => n.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('does not adjust when source > target', () => {
    const tree = [leaf('a'), leaf('b'), leaf('c'), leaf('d')];
    const next = moveNodeInTree(tree, 'd', null, 1);
    expect(next.map((n) => n.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('does not adjust when crossing parents', () => {
    const tree = [folder('src', [leaf('a')]), folder('dst', [leaf('x'), leaf('y')])];
    const next = moveNodeInTree(tree, 'a', 'dst', 1);
    expect((next[1].children ?? []).map((n) => n.id)).toEqual(['x', 'a', 'y']);
  });
});

describe('helpers', () => {
  it('findNodeInTree DFS', () => {
    const tree = [folder('f', [leaf('a')])];
    expect(findNodeInTree(tree, 'a')?.name).toBe('a');
    expect(findNodeInTree(tree, 'missing')).toBeNull();
  });

  it('isDescendant detects ancestor relationships', () => {
    const tree = [folder('parent', [leaf('child')])];
    expect(isDescendant(tree, 'parent', 'child')).toBe(true);
    expect(isDescendant(tree, 'parent', 'parent')).toBe(true);
    expect(isDescendant(tree, 'child', 'parent')).toBe(false);
  });

  it('locateNodeParent reports root vs nested', () => {
    const tree = [leaf('a'), folder('f', [leaf('b')])];
    expect(locateNodeParent(tree, 'a')).toEqual({ parent: null, index: 0 });
    expect(locateNodeParent(tree, 'b')).toEqual({ parent: 'f', index: 0 });
    expect(locateNodeParent(tree, 'missing')).toBeNull();
  });

  it('containsNodeId is recursive', () => {
    const tree = [folder('f', [leaf('a')])];
    expect(containsNodeId(tree, 'a')).toBe(true);
    expect(containsNodeId(tree, 'f')).toBe(true);
    expect(containsNodeId(tree, 'missing')).toBe(false);
  });
});

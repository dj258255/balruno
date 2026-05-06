/**
 * writeQueue unit tests — covers (1) sender registration lifecycle,
 * (2) region routing for the three baseVersion columns, (3)
 * bumpVersion's race-safe Math.max guard.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  emitOp,
  setSyncSender,
  setVersions,
  bumpVersion,
  getVersion,
  __resetWriteQueueForTests,
} from './writeQueue';
import type { MappedClientOp } from './opMapper';

describe('writeQueue', () => {
  beforeEach(() => {
    __resetWriteQueueForTests();
  });

  it('emitOp returns false when no sender is registered', () => {
    expect(
      emitOp({
        kind: 'cell.update',
        sheetId: 's1',
        rowId: 'r1',
        columnId: 'c1',
        value: 'x',
      }),
    ).toBe(false);
  });

  it('routes cell.update through data baseVersion', () => {
    const calls: MappedClientOp[] = [];
    setSyncSender((op) => {
      calls.push(op);
      return true;
    });
    setVersions({ data: 7, sheetTree: 11, docTree: 13 });

    emitOp({ kind: 'cell.update', sheetId: 's1', rowId: 'r1', columnId: 'c1', value: 42 });

    expect(calls.length).toBe(1);
    expect(calls[0]).toMatchObject({ type: 'cell.update', baseVersion: 7 });
  });

  it('routes tree.add(SHEET) through sheetTree baseVersion', () => {
    const calls: MappedClientOp[] = [];
    setSyncSender((op) => {
      calls.push(op);
      return true;
    });
    setVersions({ data: 7, sheetTree: 11, docTree: 13 });

    emitOp({
      kind: 'tree.add',
      treeKind: 'SHEET',
      parentId: null,
      position: 0,
      node: { id: 'n1' },
    });

    expect(calls[0]).toMatchObject({ type: 'tree.add', treeKind: 'SHEET', baseVersion: 11 });
  });

  it('routes tree.delete(DOC) through docTree baseVersion', () => {
    const calls: MappedClientOp[] = [];
    setSyncSender((op) => {
      calls.push(op);
      return true;
    });
    setVersions({ data: 7, sheetTree: 11, docTree: 13 });

    emitOp({ kind: 'tree.delete', treeKind: 'DOC', nodeId: 'n1' });

    expect(calls[0]).toMatchObject({ type: 'tree.delete', treeKind: 'DOC', baseVersion: 13 });
  });

  it('bumpVersion is monotonic — out-of-order acks do not regress version', () => {
    setVersions({ data: 5, sheetTree: 0, docTree: 0 });

    bumpVersion('data', 8); // broadcast arrives first
    bumpVersion('data', 6); // late ack — should not regress

    expect(getVersion('data')).toBe(8);
  });

  it('clearing the sender (setSyncSender(null)) reverts emitOp to false', () => {
    setSyncSender(() => true);
    setVersions({ data: 1, sheetTree: 0, docTree: 0 });
    expect(
      emitOp({ kind: 'cell.update', sheetId: 's1', rowId: 'r1', columnId: 'c1', value: 'x' }),
    ).toBe(true);

    setSyncSender(null);
    expect(
      emitOp({ kind: 'cell.update', sheetId: 's1', rowId: 'r1', columnId: 'c1', value: 'x' }),
    ).toBe(false);
  });
});

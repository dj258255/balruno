/**
 * opMapper unit tests — covers the three op shape families (cell /
 * row / tree) so any future ClientOp schema drift surfaces as a
 * type or assertion failure here. Full per-variant coverage is the
 * dual-write middleware test's responsibility (Stage C); this file
 * keeps the mapper itself honest.
 */

import { describe, it, expect } from 'vitest';
import { mapStoreActionToOp } from './opMapper';

describe('mapStoreActionToOp', () => {
  it('cell.update — passes through identifiers + value, adds version + msgId', () => {
    const op = mapStoreActionToOp(
      {
        kind: 'cell.update',
        sheetId: 's1',
        rowId: 'r1',
        columnId: 'c1',
        value: 42,
      },
      7,
    );
    expect(op).toMatchObject({
      type: 'cell.update',
      sheetId: 's1',
      rowId: 'r1',
      columnId: 'c1',
      value: 42,
      baseVersion: 7,
    });
    expect(op.clientMsgId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('row.add — preserves the entire row payload', () => {
    const row = { id: 'r2', cells: { c1: 'hello' } };
    const op = mapStoreActionToOp(
      { kind: 'row.add', sheetId: 's1', row: row as never },
      0,
    );
    expect(op).toMatchObject({
      type: 'row.add',
      sheetId: 's1',
      row,
      baseVersion: 0,
    });
  });

  it('tree.delete — carries treeKind so backend routes to sheet_tree vs doc_tree', () => {
    const op = mapStoreActionToOp(
      { kind: 'tree.delete', treeKind: 'DOC', nodeId: 'n1' },
      3,
    );
    expect(op).toMatchObject({
      type: 'tree.delete',
      treeKind: 'DOC',
      nodeId: 'n1',
      baseVersion: 3,
    });
  });

  it('every emitted op carries a fresh clientMsgId (no collision across calls)', () => {
    const a = mapStoreActionToOp(
      { kind: 'cell.update', sheetId: 's1', rowId: 'r1', columnId: 'c1', value: 'x' },
      0,
    );
    const b = mapStoreActionToOp(
      { kind: 'cell.update', sheetId: 's1', rowId: 'r1', columnId: 'c1', value: 'x' },
      0,
    );
    expect(a.clientMsgId).not.toBe(b.clientMsgId);
  });
});

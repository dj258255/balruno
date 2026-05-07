/**
 * cellSlice writeSheet two-mode branching — verifies that with a
 * server-canonical sender registered (hasSender() === true), every
 * mutation lands on the zustand state directly via setState. The
 * Y.Doc helper path stays untested here because it'd require
 * mocking the entire ydoc / yjs surface; that branch is covered by
 * the existing local-mode integration in production.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import {
  setSyncSender,
  __resetWriteQueueForTests,
} from '@/lib/sync/writeQueue';
import type { Sheet, Project } from '@balruno/shared';

const sheetSeed: Sheet = {
  id: 'sh1',
  name: 'Heroes',
  columns: [{ id: 'c1', name: 'HP', type: 'general' }],
  rows: [{ id: 'r1', cells: { c1: 100 } }],
  createdAt: 100,
  updatedAt: 100,
};

const projectSeed: Project = {
  id: 'p1',
  name: 'Test',
  sheets: [sheetSeed],
  createdAt: 100,
  updatedAt: 100,
};

describe('cellSlice (server-canonical mode, hasSender=true)', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [structuredClone(projectSeed)] });
    // Register a no-op sender so writeQueue.hasSender() returns true.
    // Each mutation will then take the direct-setState branch.
    setSyncSender(() => true);
  });

  afterEach(() => {
    __resetWriteQueueForTests();
  });

  it('updateCell writes the new value into state immediately', () => {
    useProjectStore.getState().updateCell('p1', 'sh1', 'r1', 'c1', 999);
    const r = useProjectStore.getState().projects[0].sheets[0].rows[0];
    expect(r.cells.c1).toBe(999);
  });

  it('addRow appends to rows[]', () => {
    const newRowId = useProjectStore.getState().addRow('p1', 'sh1', { c1: 50 });
    const rows = useProjectStore.getState().projects[0].sheets[0].rows;
    expect(rows).toHaveLength(2);
    expect(rows[1].id).toBe(newRowId);
    expect(rows[1].cells.c1).toBe(50);
  });

  it('addRow with idempotency: same id replayed does nothing', () => {
    useProjectStore.getState().addRow('p1', 'sh1', { c1: 50 }, { rowId: 'r-dup' });
    useProjectStore.getState().addRow('p1', 'sh1', { c1: 99 }, { rowId: 'r-dup' });
    const rows = useProjectStore.getState().projects[0].sheets[0].rows;
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === 'r-dup')?.cells.c1).toBe(50);
  });

  it('insertRow places at the requested index', () => {
    useProjectStore.getState().insertRow('p1', 'sh1', 0, { c1: 1 }, { rowId: 'r-first' });
    const rows = useProjectStore.getState().projects[0].sheets[0].rows;
    expect(rows[0].id).toBe('r-first');
    expect(rows[1].id).toBe('r1');
  });

  it('deleteRow removes by id', () => {
    useProjectStore.getState().deleteRow('p1', 'sh1', 'r1');
    expect(useProjectStore.getState().projects[0].sheets[0].rows).toHaveLength(0);
  });

  it('reorderRow moves by index', () => {
    const store = useProjectStore.getState();
    store.addRow('p1', 'sh1', { c1: 2 }, { rowId: 'r2' });
    store.addRow('p1', 'sh1', { c1: 3 }, { rowId: 'r3' });
    store.reorderRow('p1', 'sh1', 'r1', 2);
    const rows = useProjectStore.getState().projects[0].sheets[0].rows;
    expect(rows.map((r) => r.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('insertColumn places at the requested index', () => {
    useProjectStore.getState().insertColumn(
      'p1',
      'sh1',
      { name: 'Atk', type: 'general' },
      0,
    );
    const cols = useProjectStore.getState().projects[0].sheets[0].columns;
    expect(cols).toHaveLength(2);
    expect(cols[0].name).toBe('Atk');
    expect(cols[1].name).toBe('HP');
  });

  it('updateColumn merges the patch', () => {
    useProjectStore.getState().updateColumn('p1', 'sh1', 'c1', { name: 'Health' });
    expect(useProjectStore.getState().projects[0].sheets[0].columns[0].name).toBe('Health');
  });

  it('deleteColumn removes the column AND drops the cell-map entry', () => {
    useProjectStore.getState().deleteColumn('p1', 'sh1', 'c1');
    const sheet = useProjectStore.getState().projects[0].sheets[0];
    expect(sheet.columns).toHaveLength(0);
    expect('c1' in sheet.rows[0].cells).toBe(false);
  });

  it('reorderColumns reorders + appends missing ids defensively', () => {
    const store = useProjectStore.getState();
    store.insertColumn('p1', 'sh1', { name: 'Atk', type: 'general' }, 1);
    // pass only one of the two ids — the missing one should land at the end
    const colsBefore = useProjectStore.getState().projects[0].sheets[0].columns;
    const atkId = colsBefore.find((c) => c.name === 'Atk')!.id;
    store.reorderColumns('p1', 'sh1', [atkId]);
    const cols = useProjectStore.getState().projects[0].sheets[0].columns;
    expect(cols.map((c) => c.name)).toEqual(['Atk', 'HP']);
  });

  it('addMultipleRows appends N rows', () => {
    useProjectStore.getState().addMultipleRows('p1', 'sh1', 3);
    expect(useProjectStore.getState().projects[0].sheets[0].rows).toHaveLength(4);
  });
});

describe('cellSlice (no sender, post-v0.6 cleanup)', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [structuredClone(projectSeed)] });
    __resetWriteQueueForTests();
  });

  it('updateCell still writes setState even without a sender', () => {
    // v0.6 cleanup: the Y.Doc fallback was retired (the legacy
    // /page entry that depended on it now redirects). writeSheet
    // collapses to direct setState in both branches — sender
    // registration controls whether emitOp goes anywhere, not
    // whether the local state lands.
    useProjectStore.getState().updateCell('p1', 'sh1', 'r1', 'c1', 42);
    const r = useProjectStore.getState().projects[0].sheets[0].rows[0];
    expect(r.cells.c1).toBe(42);
  });
});

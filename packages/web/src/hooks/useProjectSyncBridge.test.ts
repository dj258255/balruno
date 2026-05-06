/**
 * hydrateProjectFromSyncFull tests — covers (1) inserting a new
 * project when the store doesn't have it, (2) sheet replacement on
 * an existing project, (3) treating malformed data as empty sheets
 * rather than throwing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { hydrateProjectFromSyncFull } from './useProjectSyncBridge';
import { useProjectStore } from '@/stores/projectStore';
import type { Sheet } from '@balruno/shared';
import type { SyncFullPayload } from './useProjectSync';

function makeSyncFull(data: unknown): SyncFullPayload {
  return {
    type: 'sync.full',
    data,
    sheetTree: [],
    docTree: [],
    versions: { data: 5, sheetTree: 0, docTree: 0 },
  };
}

const sheet1: Sheet = {
  id: 'sh1',
  name: 'Heroes',
  columns: [{ id: 'c1', name: 'HP', type: 'general' }],
  rows: [{ id: 'r1', cells: { c1: 100 } }],
  createdAt: 100,
  updatedAt: 100,
};

describe('hydrateProjectFromSyncFull', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [] });
  });

  it('inserts a new project with the broadcasted sheets when the store is empty', () => {
    hydrateProjectFromSyncFull('p1', makeSyncFull([sheet1]));

    const projects = useProjectStore.getState().projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('p1');
    expect(projects[0].sheets).toHaveLength(1);
    expect(projects[0].sheets[0].id).toBe('sh1');
  });

  it('replaces sheets on an existing project, preserves metadata', () => {
    useProjectStore.setState({
      projects: [
        {
          id: 'p1',
          name: 'My Game',
          description: 'rpg',
          createdAt: 100,
          updatedAt: 100,
          sheets: [],
        },
      ],
    });

    hydrateProjectFromSyncFull('p1', makeSyncFull([sheet1]));

    const project = useProjectStore.getState().projects[0];
    expect(project.id).toBe('p1');
    expect(project.name).toBe('My Game'); // preserved
    expect(project.description).toBe('rpg'); // preserved
    expect(project.sheets).toHaveLength(1);
    expect(project.sheets[0].name).toBe('Heroes');
  });

  it('treats malformed data (non-array) as empty sheets without throwing', () => {
    hydrateProjectFromSyncFull('p1', makeSyncFull('not an array'));

    const project = useProjectStore.getState().projects[0];
    expect(project.sheets).toEqual([]);
  });

  it('does not touch other projects when hydrating one', () => {
    useProjectStore.setState({
      projects: [
        { id: 'pA', name: 'A', sheets: [sheet1], createdAt: 0, updatedAt: 0 },
        { id: 'pB', name: 'B', sheets: [], createdAt: 0, updatedAt: 0 },
      ],
    });

    hydrateProjectFromSyncFull('pB', makeSyncFull([sheet1]));

    const projects = useProjectStore.getState().projects;
    expect(projects.find((p) => p.id === 'pA')?.sheets).toHaveLength(1);
    expect(projects.find((p) => p.id === 'pB')?.sheets).toHaveLength(1);
  });
});

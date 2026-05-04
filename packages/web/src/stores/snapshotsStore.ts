/**
 * Snapshots store — keyed by projectId. Up to 50 named snapshots per project.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId } from '@/lib/uuid';
import type { NamedSnapshot } from '@/types/snapshots';

const MAX_PER_PROJECT = 50;

interface SnapshotsState {
  byProject: Record<string, NamedSnapshot[]>;

  add: (
    projectId: string,
    args: { name: string; description?: string; createdBy: string; payload: unknown },
  ) => string;
  rename: (projectId: string, snapshotId: string, name: string) => void;
  remove: (projectId: string, snapshotId: string) => void;
  list: (projectId: string) => NamedSnapshot[];
}

export const useSnapshotsStore = create<SnapshotsState>()(
  persist(
    (set, get) => ({
      byProject: {},

      add: (projectId, args) => {
        const id = newId();
        const snap: NamedSnapshot = {
          id,
          projectId,
          name: args.name,
          description: args.description,
          createdAt: Date.now(),
          createdBy: args.createdBy,
          payload: args.payload,
        };
        set((state) => {
          const list = [...(state.byProject[projectId] ?? []), snap];
          // Cap retention by deleting oldest.
          const trimmed = list.length > MAX_PER_PROJECT ? list.slice(list.length - MAX_PER_PROJECT) : list;
          return { byProject: { ...state.byProject, [projectId]: trimmed } };
        });
        return id;
      },

      rename: (projectId, snapshotId, name) => {
        set((state) => ({
          byProject: {
            ...state.byProject,
            [projectId]: (state.byProject[projectId] ?? []).map((s) =>
              s.id === snapshotId ? { ...s, name } : s,
            ),
          },
        }));
      },

      remove: (projectId, snapshotId) => {
        set((state) => ({
          byProject: {
            ...state.byProject,
            [projectId]: (state.byProject[projectId] ?? []).filter((s) => s.id !== snapshotId),
          },
        }));
      },

      list: (projectId) =>
        [...(get().byProject[projectId] ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    }),
    { name: 'balruno-snapshots' },
  ),
);

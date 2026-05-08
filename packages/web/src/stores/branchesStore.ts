/**
 * Branches store — local cache of branches per project.
 *
 * The fork operation duplicates a project (via existing `duplicateProject` flow)
 * and tags it with a Branch entry pointing back to the parent.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId } from '@/lib/uuid';
import type { Branch, BranchStatus } from '@/types/branches';

interface BranchesState {
  branchesByProject: Record<string, Branch[]>;

  forkProject: (
    parentProjectId: string,
    branchProjectId: string,
    args: { name: string; description?: string; createdBy: string; forkVersion: number },
  ) => string;

  setStatus: (parentProjectId: string, branchId: string, status: BranchStatus, by?: string) => void;
  rename: (parentProjectId: string, branchId: string, name: string) => void;
  remove: (parentProjectId: string, branchId: string) => void;

  branchesOf: (parentProjectId: string) => Branch[];
  findByProject: (branchProjectId: string) => Branch | null;
}

export const useBranchesStore = create<BranchesState>()(
  persist(
    (set, get) => ({
      branchesByProject: {},

      forkProject: (parentProjectId, branchProjectId, args) => {
        const id = newId();
        const branch: Branch = {
          id,
          parentProjectId,
          branchProjectId,
          name: args.name,
          description: args.description,
          status: 'active',
          createdAt: Date.now(),
          createdBy: args.createdBy,
          forkVersion: args.forkVersion,
        };
        set((state) => ({
          branchesByProject: {
            ...state.branchesByProject,
            [parentProjectId]: [...(state.branchesByProject[parentProjectId] ?? []), branch],
          },
        }));
        return id;
      },

      setStatus: (parentProjectId, branchId, status, by) => {
        set((state) => ({
          branchesByProject: {
            ...state.branchesByProject,
            [parentProjectId]: (state.branchesByProject[parentProjectId] ?? []).map((b) =>
              b.id === branchId
                ? {
                    ...b,
                    status,
                    mergedAt: status === 'merged' ? Date.now() : b.mergedAt,
                    mergedBy: status === 'merged' ? by : b.mergedBy,
                  }
                : b,
            ),
          },
        }));
      },

      rename: (parentProjectId, branchId, name) => {
        set((state) => ({
          branchesByProject: {
            ...state.branchesByProject,
            [parentProjectId]: (state.branchesByProject[parentProjectId] ?? []).map((b) =>
              b.id === branchId ? { ...b, name } : b,
            ),
          },
        }));
      },

      remove: (parentProjectId, branchId) => {
        set((state) => ({
          branchesByProject: {
            ...state.branchesByProject,
            [parentProjectId]: (state.branchesByProject[parentProjectId] ?? []).filter((b) => b.id !== branchId),
          },
        }));
      },

      branchesOf: (parentProjectId) => get().branchesByProject[parentProjectId] ?? [],

      findByProject: (branchProjectId) => {
        for (const branches of Object.values(get().branchesByProject)) {
          const hit = branches.find((b) => b.branchProjectId === branchProjectId);
          if (hit) return hit;
        }
        return null;
      },
    }),
    { name: 'balruno-branches' },
  ),
);

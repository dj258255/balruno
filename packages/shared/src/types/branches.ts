/**
 * Branch types — Figma-style "Variants" for game balance experiments.
 *
 * A branch is a forked snapshot of a project ("season-2 experiment"). It carries
 * its own data and can be merged back to its parent later (CRDT auto-resolves
 * concurrent changes within sheets via LWW; user resolves cross-row conflicts).
 */

export type BranchStatus = 'active' | 'merged' | 'archived';

export interface Branch {
  id: string;
  /** Source project id this branch was forked from. */
  parentProjectId: string;
  /** Project id of the branch itself (a real cloned project). */
  branchProjectId: string;
  name: string;
  description?: string;
  status: BranchStatus;
  createdAt: number;
  createdBy: string;
  /** Snapshot of parent's `data_version` at fork time — used to compute the diff later. */
  forkVersion: number;
  /** Filled when status === 'merged'. */
  mergedAt?: number;
  mergedBy?: string;
}

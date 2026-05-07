/**
 * REST client for server-backed undo / redo (ADR 0021 v2.3 Phase 5).
 *
 * Backend endpoints:
 *   POST /api/v1/projects/{projectId}/undo
 *   POST /api/v1/projects/{projectId}/redo
 *
 * Both expect the X-Client-Session-Id header so the server can scope
 * the lookup to this tab's actions only (Baserow per-tab pattern).
 *
 * Response shape mirrors the sealed UndoResult interface on the
 * backend:
 *   - { type: 'Applied', actionGroupId, appliedOps } when an op was
 *     reversed/redone — the client uses appliedOps to update its UI
 *     hint (e.g. toast "Undid your last edit").
 *   - { type: 'NothingToUndo' } when the user's stack is empty (or
 *     all entries past the 120-min window). Frontend can treat this
 *     as a no-op + maybe show a soft toast.
 */

import { request } from './client';
import { getClientSessionId } from '@/lib/undo/sessionId';

export type UndoResult =
  | { type: 'Applied'; actionGroupId: string; appliedOps: unknown[] }
  | { type: 'NothingToUndo' };

/** Server-backed Cmd+Z. Per-tab scope via X-Client-Session-Id. */
export async function callUndo(projectId: string): Promise<UndoResult> {
  return request<UndoResult>(
    `/api/v1/projects/${projectId}/undo`,
    {
      method: 'POST',
      headers: { 'X-Client-Session-Id': getClientSessionId() },
    },
  );
}

/** Server-backed Cmd+Shift+Z. Same per-tab scope as undo. */
export async function callRedo(projectId: string): Promise<UndoResult> {
  return request<UndoResult>(
    `/api/v1/projects/${projectId}/redo`,
    {
      method: 'POST',
      headers: { 'X-Client-Session-Id': getClientSessionId() },
    },
  );
}

/**
 * Hydrate the local stack after a page refresh
 * (ADR 0021 v2.3 Phase 5.E). Returns the user's last N reversible
 * actions in this tab, newest first. Frontend separates entries
 * by `undone` to populate past (false) + future (true) stacks.
 */
export interface UndoStackEntry {
  clientMsgId: string;
  actionGroupId: string | null;
  forward: unknown[] | null;
  inverse: unknown[] | null;
  undone: boolean;
  createdAt: string;
}

export async function fetchUndoStack(projectId: string, limit = 50): Promise<UndoStackEntry[]> {
  return request<UndoStackEntry[]>(
    `/api/v1/projects/${projectId}/undo-stack?limit=${limit}`,
    {
      headers: { 'X-Client-Session-Id': getClientSessionId() },
    },
  );
}

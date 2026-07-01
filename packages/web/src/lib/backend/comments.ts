import { request } from './client';

export type CommentScopeKind = 'SHEET_CELL' | 'SHEET_ROW';

export interface BackendComment {
  id: string;
  projectId: string;
  scopeKind: CommentScopeKind;
  sheetId: string | null;
  rowId: string | null;
  columnId: string | null;
  anchorPosition: number | null;
  anchorLength: number | null;
  parentId: string | null;
  authorUserId: string;
  bodyJson: unknown; // Tiptap JSON
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput {
  projectId: string;
  scopeKind: CommentScopeKind;
  sheetId?: string;
  rowId?: string;
  columnId?: string;
  anchorPosition?: number;
  anchorLength?: number;
  parentId?: string;
  bodyJson: unknown;
}

export function createComment(input: CreateCommentInput): Promise<BackendComment> {
  return request<BackendComment>('/api/v1/comments', { method: 'POST', body: input });
}

export function updateCommentBody(id: string, bodyJson: unknown): Promise<BackendComment> {
  return request<BackendComment>(`/api/v1/comments/${id}`, {
    method: 'PATCH',
    body: { bodyJson },
  });
}

export function setCommentResolved(id: string, resolved: boolean): Promise<BackendComment> {
  return request<BackendComment>(`/api/v1/comments/${id}`, {
    method: 'PATCH',
    body: { resolved },
  });
}

export function deleteComment(id: string): Promise<void> {
  return request<void>(`/api/v1/comments/${id}`, { method: 'DELETE' });
}

export interface ListCommentsForCellInput {
  projectId: string;
  sheetId: string;
  rowId: string;
  columnId: string;
}

export function listCommentsForCell(input: ListCommentsForCellInput): Promise<BackendComment[]> {
  const params = new URLSearchParams({
    scope: 'SHEET_CELL',
    sheetId: input.sheetId,
    rowId: input.rowId,
    columnId: input.columnId,
  });
  return request<BackendComment[]>(
    `/api/v1/projects/${input.projectId}/comments?${params.toString()}`,
  );
}

export interface ListCommentsForRowInput {
  projectId: string;
  sheetId: string;
  rowId: string;
}

/**
 * Row-anchored (record-level) comments — scope SHEET_ROW, columnId
 * null (Airtable/Baserow record thread). Mirrors listCommentsForCell
 * but omits columnId; the backend keys the thread on (sheetId, rowId).
 */
export function listCommentsForRow(input: ListCommentsForRowInput): Promise<BackendComment[]> {
  const params = new URLSearchParams({
    scope: 'SHEET_ROW',
    sheetId: input.sheetId,
    rowId: input.rowId,
  });
  return request<BackendComment[]>(
    `/api/v1/projects/${input.projectId}/comments?${params.toString()}`,
  );
}

export function listInbox(limit = 50): Promise<BackendComment[]> {
  return request<BackendComment[]>(`/api/v1/me/inbox?limit=${limit}`);
}

/**
 * Project-wide browse — every non-deleted comment in the project,
 * newest first, server-capped at 200. Backing the dock CommentsPanel.
 * scope param is omitted so the backend short-circuits to the
 * project-wide path.
 */
export function listCommentsForProject(projectId: string): Promise<BackendComment[]> {
  return request<BackendComment[]>(`/api/v1/projects/${projectId}/comments`);
}

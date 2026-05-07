import { request } from './client';

export type CommentScopeKind = 'SHEET_CELL' | 'DOC_BODY';

export interface BackendComment {
  id: string;
  projectId: string;
  scopeKind: CommentScopeKind;
  sheetId: string | null;
  rowId: string | null;
  columnId: string | null;
  documentId: string | null;
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
  documentId?: string;
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

export function listCommentsForDoc(
  projectId: string,
  documentId: string,
): Promise<BackendComment[]> {
  const params = new URLSearchParams({ scope: 'DOC_BODY', documentId });
  return request<BackendComment[]>(
    `/api/v1/projects/${projectId}/comments?${params.toString()}`,
  );
}

export function listInbox(limit = 50): Promise<BackendComment[]> {
  return request<BackendComment[]>(`/api/v1/me/inbox?limit=${limit}`);
}

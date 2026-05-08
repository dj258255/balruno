import { request } from './client';

export interface SearchHit {
  kind: 'cell' | 'column' | 'sheet-tree' | 'doc-tree' | 'comment';
  sheetId?: string;
  sheetName?: string;
  rowId?: string;
  columnId?: string;
  nodeId?: string;
  commentId?: string;
  documentId?: string;
  scopeKind?: string;
  snippet: string;
}

export function searchProject(projectId: string, q: string): Promise<{ hits: SearchHit[] }> {
  const params = new URLSearchParams({ q });
  return request<{ hits: SearchHit[] }>(`/api/v1/projects/${projectId}/search?${params}`);
}

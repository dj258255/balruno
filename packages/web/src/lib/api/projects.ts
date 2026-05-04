/**
 * Project REST API client (coarse-grained only).
 * Cell/row/column writes go through WebSocket (/ws/sheets/{id}).
 * Document writes go through Hocuspocus (/ws/docs/{id}).
 * See docs/backend/04-api-spec.md v1.1 §3 + §11.
 */

import { api } from './client';

export interface ProjectMeta {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  description?: string;
  visibility: 'private' | 'workspace';
  dataVersion: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInitialSnapshot extends ProjectMeta {
  data: unknown;
}

export const projectApi = {
  list: (workspaceId?: string) =>
    api.get<ProjectMeta[]>(
      workspaceId ? `/api/projects?workspaceId=${workspaceId}` : '/api/projects',
    ),

  create: (workspaceId: string, name: string, description?: string) =>
    api.post<ProjectMeta>('/api/projects', { body: { workspaceId, name, description } }),

  /** Coarse-grained meta update (name/description/visibility only). Cell/row writes via WS. */
  patch: (id: string, body: Partial<Pick<ProjectMeta, 'name' | 'description' | 'visibility'>>) =>
    api.patch<ProjectMeta>(`/api/projects/${id}`, { body }),

  remove: (id: string) => api.delete<void>(`/api/projects/${id}`),

  /** Initial snapshot for hydrate (sheets/folders/changelog). Document binary fetched separately via Hocuspocus. */
  snapshot: (id: string) => api.get<ProjectInitialSnapshot>(`/api/projects/${id}`),

  duplicate: (id: string, targetWorkspaceId?: string) =>
    api.post<ProjectMeta>(`/api/projects/${id}/duplicate`, {
      body: targetWorkspaceId ? { targetWorkspaceId } : {},
    }),

  move: (id: string, targetWorkspaceId: string) =>
    api.patch<ProjectMeta>(`/api/projects/${id}/move`, { body: { targetWorkspaceId } }),

  exportJson: (id: string) => api.get<unknown>(`/api/projects/${id}/export?format=json`),
};

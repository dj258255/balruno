import { request } from './client';
import type { Project } from './types';

export function listProjects(workspaceId: string): Promise<Project[]> {
  return request<Project[]>(`/api/v1/workspaces/${workspaceId}/projects`);
}

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
  /**
   * When true, the backend seeds the new project with the full
   * ADR 0020 starter pack (12 starters from
   * resources/starter/catalog-{locale}.json) instead of the
   * minimal Sheet 1. Used by the empty-state auto-seed on
   * /workspaces and /w/[slug] so a user with no projects yet
   * lands on a populated project on first visit.
   */
  withStarterPack?: boolean;
}

export function createProject(workspaceId: string, input: CreateProjectInput): Promise<Project> {
  const { withStarterPack, ...body } = input;
  const path = withStarterPack
    ? `/api/v1/workspaces/${workspaceId}/projects?withStarterPack=true`
    : `/api/v1/workspaces/${workspaceId}/projects`;
  return request<Project>(path, {
    method: 'POST',
    body,
  });
}

export function getProject(id: string): Promise<Project> {
  return request<Project>(`/api/v1/projects/${id}`);
}

export function updateProject(
  id: string,
  patch: { slug?: string; name?: string; description?: string | null },
): Promise<Project> {
  return request<Project>(`/api/v1/projects/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/api/v1/projects/${id}`, { method: 'DELETE' });
}

import { request } from './client';
import type { Project } from './types';

export function listProjects(workspaceId: string): Promise<Project[]> {
  return request<Project[]>(`/api/v1/workspaces/${workspaceId}/projects`);
}

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
}

export function createProject(workspaceId: string, input: CreateProjectInput): Promise<Project> {
  return request<Project>(`/api/v1/workspaces/${workspaceId}/projects`, {
    method: 'POST',
    body: input,
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

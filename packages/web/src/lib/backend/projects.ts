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
  /**
   * Optional locale override for the starter pack catalogue. When
   * present, the backend picks `catalog-{locale}.json` instead of
   * the user record's stored preference (JWT claim). Lets the
   * frontend pass the currently-active i18n locale at click time —
   * the user toggling KO ↔ EN should immediately produce sheets in
   * that language.
   */
  locale?: string;
}

export function createProject(workspaceId: string, input: CreateProjectInput): Promise<Project> {
  const { withStarterPack, locale, ...body } = input;
  const params = new URLSearchParams();
  if (withStarterPack) params.set('withStarterPack', 'true');
  if (locale) params.set('locale', locale);
  const qs = params.toString();
  const path = qs
    ? `/api/v1/workspaces/${workspaceId}/projects?${qs}`
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

/**
 * Sidebar drag-drop reorder. The caller computes a lexorank midpoint
 * between the two siblings the project lands between (lib/lexorank);
 * backend stores it in projects.sort_key (V25). listProjects orders
 * by sort_key, so the next list fetch reflects the new order.
 */
export function setProjectPosition(id: string, sortKey: string): Promise<Project> {
  return request<Project>(`/api/v1/projects/${id}/position`, {
    method: 'POST',
    body: { sortKey },
  });
}

/**
 * Server-side sheet duplicate. Backend deep-clones the source sheet
 * (regenerates ids), grafts a new tree leaf next to the source, and
 * broadcasts sync.full so every connected peer rehydrates with the
 * extra sheet visible. Caller usually setCurrentSheet to the
 * returned id so the user lands on the duplicate.
 */
export function duplicateSheet(projectId: string, sheetId: string): Promise<{ newSheetId: string }> {
  return request<{ newSheetId: string }>(
    `/api/v1/projects/${projectId}/sheets/${sheetId}/duplicate`,
    { method: 'POST' },
  );
}

/**
 * Server-side doc duplicate. Backend deep-clones the source doc's
 * ydoc_state into a fresh row, grafts a new doc_tree leaf next to
 * the source, and broadcasts sync.full so peers see the clone. The
 * snapshot reflects the last-stored ydoc_state — Hocuspocus throttles
 * onStoreDocument so very recent in-memory edits may lag.
 */
export function duplicateDoc(projectId: string, docId: string): Promise<{ newDocId: string }> {
  return request<{ newDocId: string }>(
    `/api/v1/projects/${projectId}/docs/${docId}/duplicate`,
    { method: 'POST' },
  );
}

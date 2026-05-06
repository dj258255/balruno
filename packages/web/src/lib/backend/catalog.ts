import { request } from './client';

/**
 * Starter pack group metadata — used by the "Add from template"
 * modal to render selectable cards. Mirrors backend
 * StarterPackSeeder.GroupSummary; field names are stable.
 */
export interface CatalogGroupSummary {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sheetCount: number;
}

/**
 * GET /v1/catalog?locale=ko — list importable starter pack groups.
 * Backend falls back to ko when the requested locale is missing,
 * so a stale browser locale won't 404 the modal.
 */
export function listCatalog(locale?: string): Promise<CatalogGroupSummary[]> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  return request<CatalogGroupSummary[]>(`/api/v1/catalog${qs}`);
}

/**
 * POST /v1/projects/{id}/templates/{groupId}?locale=ko — graft a
 * starter pack group onto an existing project. Backend mutates
 * data + sheet_tree atomically and broadcasts a sync.full frame to
 * every connected session, so the caller (and peers) see the new
 * sheets via their existing WebSocket — no manual refresh needed.
 */
export function importTemplate(
  projectId: string,
  groupId: string,
  locale?: string,
): Promise<void> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  return request<void>(
    `/api/v1/projects/${projectId}/templates/${encodeURIComponent(groupId)}${qs}`,
    { method: 'POST' },
  );
}

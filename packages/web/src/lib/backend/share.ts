/**
 * REST client for share links (ADR 0027).
 *
 * Authoring endpoints take a JWT (handled by request() automatically).
 * The public read endpoint is unauthenticated — it goes through the
 * same request() helper but the backend's SecurityConfig permitAll's
 * /api/v1/share-public/** so the absent JWT is fine.
 */

import { request } from './client';

export interface ShareLink {
  id: string;
  projectId: string;
  sheetId: string | null;
  activeView: string | null;
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreateShareLinkInput {
  sheetId?: string | null;
  activeView?: string | null;
  expiresAt?: string | null;
}

export function createShareLink(
  projectId: string,
  input: CreateShareLinkInput,
): Promise<ShareLink> {
  return request<ShareLink>(`/api/v1/projects/${projectId}/share-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function listShareLinks(projectId: string): Promise<ShareLink[]> {
  return request<ShareLink[]>(`/api/v1/projects/${projectId}/share-links`);
}

export async function revokeShareLink(linkId: string): Promise<void> {
  await request<void>(`/api/v1/share-links/${linkId}`, { method: 'DELETE' });
}

export interface PublicReadResponse {
  link: ShareLink;
  projectSnapshot: {
    id: string;
    name: string;
    data: unknown;
    sheetTree: unknown;
    versions: { data: number; sheetTree: number };
  };
}

export function fetchPublicShare(token: string): Promise<PublicReadResponse> {
  return request<PublicReadResponse>(`/api/v1/share-public/${token}`);
}

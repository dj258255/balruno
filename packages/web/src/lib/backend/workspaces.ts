import { request } from './client';
import type {
  CreatedInvite,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from './types';

// ── workspace CRUD ───────────────────────────────────────────────────

export function listWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>('/api/v1/workspaces');
}

export function createWorkspace(slug: string, name: string): Promise<Workspace> {
  return request<Workspace>('/api/v1/workspaces', {
    method: 'POST',
    body: { slug, name },
  });
}

export function getWorkspace(id: string): Promise<Workspace> {
  return request<Workspace>(`/api/v1/workspaces/${id}`);
}

export function updateWorkspace(
  id: string,
  patch: { slug?: string; name?: string },
): Promise<Workspace> {
  return request<Workspace>(`/api/v1/workspaces/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function deleteWorkspace(id: string): Promise<void> {
  return request<void>(`/api/v1/workspaces/${id}`, { method: 'DELETE' });
}

// ── members ──────────────────────────────────────────────────────────

export function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return request<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`);
}

export function changeMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<WorkspaceMember> {
  return request<WorkspaceMember>(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    { method: 'PATCH', body: { role } },
  );
}

export function removeMember(workspaceId: string, userId: string): Promise<void> {
  return request<void>(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    { method: 'DELETE' },
  );
}

// ── invites ──────────────────────────────────────────────────────────

export interface CreateInviteOptions {
  /** Defaults to VIEWER on the server when omitted. */
  role?: WorkspaceRole;
  /** ISO 8601 duration like 'P7D'. Server caps at 30 days. */
  expiresIn?: string;
}

export function createInvite(
  workspaceId: string,
  opts: CreateInviteOptions = {},
): Promise<CreatedInvite> {
  return request<CreatedInvite>(`/api/v1/workspaces/${workspaceId}/invites`, {
    method: 'POST',
    body: opts,
  });
}

export function listInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  return request<WorkspaceInvite[]>(`/api/v1/workspaces/${workspaceId}/invites`);
}

export function revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
  return request<void>(
    `/api/v1/workspaces/${workspaceId}/invites/${inviteId}`,
    { method: 'DELETE' },
  );
}

export function acceptInvite(rawToken: string): Promise<WorkspaceMember> {
  return request<WorkspaceMember>(
    `/api/v1/invites/${encodeURIComponent(rawToken)}/accept`,
    { method: 'POST' },
  );
}

/**
 * The URL a workspace owner shares for invite acceptance. The frontend
 * route at /i/{token} routes through OAuth login (if needed) and then
 * calls {@link acceptInvite}.
 */
export function inviteShareUrl(rawToken: string): string {
  if (typeof window === 'undefined') return `/i/${encodeURIComponent(rawToken)}`;
  return `${window.location.origin}/i/${encodeURIComponent(rawToken)}`;
}

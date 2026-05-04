/**
 * Workspace REST API client.
 * Endpoints: docs/backend/04-api-spec.md v1.1 (workspace + members + invitations).
 */

import { api } from './client';

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  isDefault: boolean;
  createdAt: string;
  ownerId: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface WorkspaceMember {
  userId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

export const workspaceApi = {
  list: () => api.get<Workspace[]>('/api/workspaces'),

  create: (name: string) => api.post<Workspace>('/api/workspaces', { body: { name } }),

  rename: (id: string, name: string) =>
    api.patch<Workspace>(`/api/workspaces/${id}`, { body: { name } }),

  remove: (id: string) => api.delete<void>(`/api/workspaces/${id}`),

  members: (id: string) => api.get<WorkspaceMember[]>(`/api/workspaces/${id}/members`),

  invite: (id: string, email: string, role: WorkspaceRole) =>
    api.post<WorkspaceInvitation>(`/api/workspaces/${id}/invitations`, { body: { email, role } }),

  invitations: (id: string) =>
    api.get<WorkspaceInvitation[]>(`/api/workspaces/${id}/invitations`),

  cancelInvitation: (workspaceId: string, invitationId: string) =>
    api.delete<void>(`/api/workspaces/${workspaceId}/invitations/${invitationId}`),

  changeRole: (workspaceId: string, userId: string, role: WorkspaceRole) =>
    api.patch<void>(`/api/workspaces/${workspaceId}/members/${userId}`, { body: { role } }),

  removeMember: (workspaceId: string, userId: string) =>
    api.delete<void>(`/api/workspaces/${workspaceId}/members/${userId}`),

  acceptInvite: (token: string) =>
    api.post<{ workspaceId: string }>('/api/invitations/accept', { body: { token } }),

  inviteInfo: (token: string) =>
    api.get<{ workspaceName: string; inviterName: string; role: WorkspaceRole }>(
      `/api/invitations/${encodeURIComponent(token)}`,
      { noAuth: true },
    ),
};

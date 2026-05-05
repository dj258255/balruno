/** Mirrors the public records exposed by the backend's domain modules. */

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  locale: string;
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'BUILDER' | 'EDITOR' | 'VIEWER';

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  'OWNER',
  'ADMIN',
  'BUILDER',
  'EDITOR',
  'VIEWER',
] as const;

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
}

/** Returned only at invite creation time — `rawToken` is shown once. */
export interface CreatedInvite {
  invite: WorkspaceInvite;
  rawToken: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

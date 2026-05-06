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

export type WorkspacePlan = 'FREE' | 'PRO' | 'TEAM';

export interface WorkspaceLimits {
  maxMembersPerWorkspace: number;
  maxProjectsPerWorkspace: number;
  maxSheetsPerProject: number;
  maxRowsPerSheet: number;
  maxCellsPerProject: number;
  maxDocumentsPerProject: number;
  maxAttachmentBytes: number;
  historyRetentionDays: number;
  aiRequestsPerMonth: number;
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  plan: WorkspacePlan;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceQuotaUsage {
  workspaceId: string;
  slug: string;
  name: string;
  plan: WorkspacePlan;
  memberCount: number;
  projectCount: number;
  limits: WorkspaceLimits;
}

export interface UserQuota {
  userId: string;
  ownedWorkspaces: number;
  workspaces: WorkspaceQuotaUsage[];
}

export interface UserBrief {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

/**
 * Enriched form returned by `GET /api/v1/workspaces/{id}/members` — the
 * directory module joins WorkspaceMember with UserDirectoryService so
 * the member list arrives ready to render. Mutation responses keep the
 * bare {@link WorkspaceMember} shape; callers reload the list afterwards.
 */
export interface WorkspaceMemberView {
  workspaceId: string;
  userId: string;
  user: UserBrief | null;
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

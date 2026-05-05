/**
 * Public surface of the Balruno backend integration.
 *
 * Browser callers rely on the cookie set after OAuth login; bearer
 * tokens are accepted via the {@code bearer} option for non-browser
 * callers (Electron, future CLI). All errors land as
 * {@link BackendError} with RFC 7807 fields parsed out.
 */

export { backendBaseUrl, BackendError, request } from './client';
export type { ProblemDetail, RequestOptions } from './client';

export { fetchCurrentUser } from './me';
export { oauthLoginUrl, startOAuthLogin } from './oauth';
export type { OAuthProvider } from './oauth';

export type {
  AuthenticatedUser,
  CreatedInvite,
  Project,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from './types';
export { WORKSPACE_ROLES } from './types';

export {
  acceptInvite,
  changeMemberRole,
  createInvite,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  inviteShareUrl,
  listInvites,
  listWorkspaceMembers,
  listWorkspaces,
  removeMember,
  revokeInvite,
  updateWorkspace,
} from './workspaces';
export type { CreateInviteOptions } from './workspaces';

export {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from './projects';
export type { CreateProjectInput } from './projects';

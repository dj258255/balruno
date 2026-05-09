/**
 * Public surface of the Balruno backend integration.
 *
 * Browser callers rely on the cookie set after OAuth login; bearer
 * tokens are accepted via the {@code bearer} option for non-browser
 * callers (Electron, future CLI). All errors land as
 * {@link BackendError} with RFC 7807 fields parsed out.
 */

export {
  backendBaseUrl,
  BackendError,
  isBackendConfigured,
  request,
} from './client';
export type { ProblemDetail, RequestOptions } from './client';

export { fetchCurrentUser } from './me';
export { oauthLoginUrl, startOAuthLogin } from './oauth';
export type { OAuthProvider } from './oauth';

export type {
  AuthenticatedUser,
  CreatedInvite,
  Project,
  UserBrief,
  UserQuota,
  Workspace,
  WorkspaceInvite,
  WorkspaceLimits,
  WorkspaceMember,
  WorkspaceMemberView,
  WorkspacePlan,
  WorkspaceQuotaUsage,
  WorkspaceRole,
} from './types';
export { WORKSPACE_ROLES } from './types';

export { fetchUserQuota, isUnlimited } from './quota';

export { fetchCollabToken, collabBaseUrl, isCollabConfigured } from './collab';
export type { CollabTokenResponse } from './collab';

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
  duplicateSheet,
  getProject,
  listProjects,
  setProjectPosition,
  updateProject,
} from './projects';
export type { CreateProjectInput } from './projects';

export { listCatalog, importTemplate } from './catalog';
export type { CatalogGroupSummary } from './catalog';

export { fetchAuditLog } from './audit';
export type { AuditEntry, FetchAuditLogOptions } from './audit';

export {
  createComment,
  updateCommentBody,
  setCommentResolved,
  deleteComment,
  listCommentsForCell,
  listCommentsForDoc,
  listCommentsForProject,
  listInbox,
} from './comments';
export type {
  BackendComment,
  CommentScopeKind,
  CreateCommentInput,
  ListCommentsForCellInput,
} from './comments';

export {
  createShareLink,
  listShareLinks,
  revokeShareLink,
  fetchPublicShare,
} from './share';
export type {
  ShareLink,
  CreateShareLinkInput,
  PublicReadResponse,
} from './share';

export {
  createWebhook,
  listWebhooks,
  toggleWebhook,
  deleteWebhook,
  KNOWN_WEBHOOK_EVENTS,
} from './webhooks';
export type {
  BackendWebhook,
  CreateWebhookInput,
  WebhookEvent,
} from './webhooks';

export {
  getNotificationPreference,
  updateNotificationPreference,
  fetchVapidPublicKey,
  saveWebPushSubscription,
  listWebPushSubscriptions,
  deleteWebPushSubscription,
} from './notification';
export type {
  NotificationPreference,
  DigestFrequency,
  UpdatePreferenceInput,
  BackendWebPushSubscription,
  SubscribeInput,
} from './notification';

export {
  createInboundWebhook,
  listInboundWebhooks,
  deleteInboundWebhook,
} from './inbound';
export type {
  InboundWebhook,
  InboundProvider,
  CreateInboundWebhookInput,
} from './inbound';

export {
  createDiscordLink,
  listDiscordLinks,
  deleteDiscordLink,
} from './discord';
export type {
  DiscordLink,
  CreateDiscordLinkInput,
} from './discord';

export {
  exportMyData,
  deleteMyAccount,
  downloadDataExport,
} from './account';

export {
  startCheckout,
  openCustomerPortal,
} from './billing';
export type { Plan } from './billing';

export { searchProject } from './search';
export type { SearchHit } from './search';

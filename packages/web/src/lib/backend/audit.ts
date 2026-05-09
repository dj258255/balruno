import { request } from './client';

/**
 * Workspace audit log entry — mirrors backend AuditEntry record (ADR
 * 0032 v1.0). Other modules (project / comment / workspace.member /
 * webhook / discord / ...) publish AuditLogEvent via Spring's
 * ApplicationEvent and the audit module persists the row + exposes
 * it through this endpoint.
 *
 * The set of `action` codes grows over time; the frontend renders
 * unknown actions as a fallback "{actor} performed {action}" so a
 * new backend event doesn't break the panel.
 */
export interface AuditEntry {
  id: string;
  workspaceId: string;
  /** Actor uuid; null when the event was system-driven (cron, etc.). */
  actorUserId: string | null;
  /** Dotted action code, e.g. 'project.created', 'workspace.member.added'. */
  action: string;
  /** Resource bucket — 'project' / 'comment' / 'workspace.member' / ... */
  resourceType: string;
  /** Optional id of the affected resource. */
  resourceId: string | null;
  /** Per-action JSON cargo. Frontend reads selected fields per action. */
  payload: Record<string, unknown> | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface FetchAuditLogOptions {
  /** Maximum entries returned (default 100, backend cap may apply). */
  limit?: number;
}

/**
 * Lists the workspace's recent audit entries, newest first. The
 * caller must be a workspace member; non-members get a 404 from the
 * backend (matching the privacy posture used on /workspaces).
 */
export function fetchAuditLog(
  workspaceId: string,
  options: FetchAuditLogOptions = {},
): Promise<AuditEntry[]> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  const qs = params.toString();
  const path = qs
    ? `/api/v1/workspaces/${workspaceId}/audit-log?${qs}`
    : `/api/v1/workspaces/${workspaceId}/audit-log`;
  return request<AuditEntry[]>(path);
}

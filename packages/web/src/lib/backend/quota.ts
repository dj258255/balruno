/**
 * Quota readout — what the user currently has versus what each of their
 * workspaces allows. Surfaces FR-LIMIT-003 (`GET /api/v1/me/quota`).
 *
 * Workspace creation itself is uncapped (Notion / Airtable / Baserow /
 * AFFiNE pattern), so this module no longer carries an "owned-workspace
 * limit reached" helper — the per-workspace caps (members, projects,
 * rows, …) are what gate abuse, and the frontend reads them off each
 * {@code WorkspaceQuotaUsage}. The {@link isUnlimited} sentinel still
 * shows up for paid-tier resources where {@code Integer.MAX_VALUE}
 * encodes "no cap."
 */

import { request } from './client';
import type { UserQuota } from './types';

/** {@code Integer.MAX_VALUE} on the JVM side — the unlimited sentinel. */
const UNLIMITED_SENTINEL = 2_147_483_647;

export function fetchUserQuota(): Promise<UserQuota> {
  return request<UserQuota>('/api/v1/me/quota');
}

export function isUnlimited(value: number): boolean {
  return value >= UNLIMITED_SENTINEL;
}

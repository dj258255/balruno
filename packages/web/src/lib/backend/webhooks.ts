/**
 * REST client for outbound webhooks (ADR 0028).
 */

import { request } from './client';

export interface BackendWebhook {
  id: string;
  projectId: string;
  url: string;
  events: string[];
  /** Secret only present on the create() response. List / get null
   *  this field so it can't leak from the audit log. */
  secret: string | null;
  active: boolean;
  lastAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
}

export const KNOWN_WEBHOOK_EVENTS = ['comment.added', 'mention.created', 'row.added'] as const;
export type WebhookEvent = (typeof KNOWN_WEBHOOK_EVENTS)[number];

export function createWebhook(
  projectId: string,
  input: CreateWebhookInput,
): Promise<BackendWebhook> {
  return request<BackendWebhook>(`/api/v1/projects/${projectId}/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function listWebhooks(projectId: string): Promise<BackendWebhook[]> {
  return request<BackendWebhook[]>(`/api/v1/projects/${projectId}/webhooks`);
}

export async function toggleWebhook(webhookId: string, active: boolean): Promise<void> {
  await request<void>(`/api/v1/webhooks/${webhookId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await request<void>(`/api/v1/webhooks/${webhookId}`, { method: 'DELETE' });
}

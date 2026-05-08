/**
 * REST client for inbound webhooks (ADR 0029).
 */

import { request } from './client';

export type InboundProvider = 'github' | 'generic';

export interface InboundWebhook {
  id: string;
  projectId: string;
  provider: InboundProvider;
  targetSheetId: string;
  secret: string;
  columnMapping: Record<string, string> | null;
  active: boolean;
  lastReceivedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateInboundWebhookInput {
  provider: InboundProvider;
  targetSheetId: string;
  columnMapping?: Record<string, string> | null;
}

export function createInboundWebhook(
  projectId: string,
  input: CreateInboundWebhookInput,
): Promise<InboundWebhook> {
  return request<InboundWebhook>(`/api/v1/projects/${projectId}/inbound-webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function listInboundWebhooks(projectId: string): Promise<InboundWebhook[]> {
  return request<InboundWebhook[]>(`/api/v1/projects/${projectId}/inbound-webhooks`);
}

export async function deleteInboundWebhook(id: string): Promise<void> {
  await request<void>(`/api/v1/inbound-webhooks/${id}`, { method: 'DELETE' });
}

/**
 * Stripe billing REST client (ADR 0004).
 */

import { request } from './client';

export type Plan = 'FREE' | 'PRO' | 'TEAM';

export async function startCheckout(
  workspaceId: string,
  plan: Exclude<Plan, 'FREE'>,
  successUrl: string,
  cancelUrl: string,
): Promise<void> {
  const { url } = await request<{ url: string }>(
    `/api/v1/workspaces/${workspaceId}/billing/checkout`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, successUrl, cancelUrl }),
    },
  );
  window.location.href = url;
}

export async function openCustomerPortal(
  workspaceId: string,
  returnUrl: string,
): Promise<void> {
  const { url } = await request<{ url: string }>(
    `/api/v1/workspaces/${workspaceId}/billing/portal`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl }),
    },
  );
  window.location.href = url;
}

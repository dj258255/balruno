/**
 * REST client for notification preferences + Web Push subscriptions
 * (ADR 0024 Stage I).
 */

import { request } from './client';

export type DigestFrequency = 'instant' | 'daily' | 'weekly' | 'off';

export interface NotificationPreference {
  userId: string;
  emailOnMention: boolean;
  emailOnCommentReply: boolean;
  pushOnMention: boolean;
  pushOnCommentReply: boolean;
  digestFrequency: DigestFrequency;
  updatedAt: string | null;
}

export interface UpdatePreferenceInput {
  emailOnMention?: boolean;
  emailOnCommentReply?: boolean;
  pushOnMention?: boolean;
  pushOnCommentReply?: boolean;
  digestFrequency?: DigestFrequency;
}

export interface BackendWebPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function getNotificationPreference(): Promise<NotificationPreference> {
  return request<NotificationPreference>('/api/v1/me/notification-preferences');
}

export function updateNotificationPreference(
  input: UpdatePreferenceInput,
): Promise<NotificationPreference> {
  return request<NotificationPreference>('/api/v1/me/notification-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchVapidPublicKey(): Promise<{ publicKey: string }> {
  return request<{ publicKey: string }>('/api/v1/notification/vapid-public-key');
}

export function saveWebPushSubscription(
  input: SubscribeInput,
): Promise<BackendWebPushSubscription> {
  return request<BackendWebPushSubscription>('/api/v1/me/web-push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function listWebPushSubscriptions(): Promise<BackendWebPushSubscription[]> {
  return request<BackendWebPushSubscription[]>('/api/v1/me/web-push-subscriptions');
}

export async function deleteWebPushSubscription(id: string): Promise<void> {
  await request<void>(`/api/v1/me/web-push-subscriptions/${id}`, { method: 'DELETE' });
}

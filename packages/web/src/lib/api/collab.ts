/**
 * Collab token API — short-lived token for Hocuspocus document WebSocket.
 * docs/backend/01-auth.md v1.1 §4.3, 04-api-spec.md §2.8.1.
 */

import { api } from './client';

export interface CollabTokenResponse {
  collabToken: string;
  expiresAt: string;
}

export const collabApi = {
  /** Spring issues a 15-minute token for the given documentId. Hocuspocus verifies via webhook. */
  getToken: (documentId: string) =>
    api.post<CollabTokenResponse>('/api/auth/collab-token', { body: { documentId } }),
};

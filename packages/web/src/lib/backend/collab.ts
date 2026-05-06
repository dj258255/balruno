/**
 * Collab session token + Hocuspocus WS URL helpers.
 *
 * Spring backend mints a short-lived JWT (POST /api/v1/auth/collab-token,
 * ADR 0017 Stage C) carrying sub=userId, aud=balruno-collab, doc=<UUID>.
 * The Hocuspocus container verifies the same signature on handshake
 * (packages/collab/src/auth.ts) so this module is the bridge: ask
 * Spring for a token, hand it to {@link import('@hocuspocus/provider').HocuspocusProvider}
 * along with the WS URL built here.
 *
 * The Hocuspocus URL is the apex (no path) — the provider appends
 * {@code name} as the document path, which our server reads as
 * {@code data.documentName} and verifies against the token's "doc"
 * claim.
 */

import { request } from './client';

export interface CollabTokenResponse {
  collabToken: string;
  /** ISO 8601 timestamp; the provider should reconnect with a fresh token before this. */
  expiresAt: string;
}

export function fetchCollabToken(documentId: string): Promise<CollabTokenResponse> {
  return request<CollabTokenResponse>('/api/v1/auth/collab-token', {
    method: 'POST',
    body: { documentId },
  });
}

/**
 * Hocuspocus WS base URL — the document name is appended by the
 * provider, not by this helper. Defaults to the production hostname so
 * a self-host operator who forgets to set the env still reaches their
 * own collab server if they aliased its DNS to {@code collab.balruno.com}.
 * Override in {@code .env.local} or Vercel project env.
 */
export function collabBaseUrl(): string {
  if (typeof process === 'undefined') return 'wss://collab.balruno.com';
  return (
    process.env.NEXT_PUBLIC_BALRUNO_COLLAB_URL ??
    process.env.NEXT_PUBLIC_WS_URL ??
    'wss://collab.balruno.com'
  );
}

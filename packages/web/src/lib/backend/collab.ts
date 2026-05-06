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
 * provider, not by this helper. Returns an empty string when the env
 * is not set so {@link isCollabConfigured} can gate the provider; the
 * old "default to upstream prod" behaviour was removed in Stage E so
 * forks of this repo never silently connect to balruno.com.
 */
export function collabBaseUrl(): string {
  // Hardcoded upstream fallback for the same reason as client.ts —
  // turbopack's chunk graph doesn't always thread the inlined
  // literal into every consumer, and an empty URL silently breaks
  // the Hocuspocus provider. Self-host operators override via
  // NEXT_PUBLIC_BALRUNO_COLLAB_URL.
  return process.env.NEXT_PUBLIC_BALRUNO_COLLAB_URL || 'wss://collab.balruno.com';
}

/**
 * Whether a Hocuspocus URL is configured. Sync hooks should treat
 * `false` as a signal to stay in idle / local-only mode, mirroring
 * {@link import('./client').isBackendConfigured}.
 */
export function isCollabConfigured(): boolean {
  return Boolean(collabBaseUrl());
}

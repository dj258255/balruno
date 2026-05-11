// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Collab token verification.
 *
 * The Spring backend issues short-lived (15 min) HS256 tokens via
 * POST /api/v1/auth/collab-token. The Hocuspocus server verifies the
 * token on every connection's onAuthenticate hook — same shared secret,
 * different audience claim from the API session JWT so a leak in either
 * surface doesn't compromise the other.
 *
 * Stage A scope: this module is wired in but the matching Spring
 * endpoint lands in Stage C (ADR 0017 §2.1). Until then any non-empty
 * token will fail verification and the WS handshake errors out — that's
 * the expected behaviour while the backend half is unfinished.
 */

import jwt from 'jsonwebtoken';

const SECRET = process.env.COLLAB_TOKEN_SECRET;
if (!SECRET) {
  throw new Error('COLLAB_TOKEN_SECRET environment variable is required');
}
const SECRET_BYTES = Buffer.from(SECRET, 'base64');

/** Subset of the JWT claims the collab server actually reads. */
export interface CollabTokenClaims {
  /** The user id the token was issued to. */
  sub: string;
  /** The document UUID the token grants access to. */
  doc: string;
  /** Standard JWT timestamps (seconds since epoch). */
  iat: number;
  exp: number;
}

export function verifyCollabToken(token: string): CollabTokenClaims {
  const claims = jwt.verify(token, SECRET_BYTES, {
    algorithms: ['HS256'],
    audience: 'balruno-collab',
  });
  if (typeof claims !== 'object' || claims === null) {
    throw new Error('collab token claims malformed');
  }
  const { sub, doc, iat, exp } = claims as Partial<CollabTokenClaims>;
  if (typeof sub !== 'string' || typeof doc !== 'string'
      || typeof iat !== 'number' || typeof exp !== 'number') {
    throw new Error('collab token missing required claims');
  }
  return { sub, doc, iat, exp };
}

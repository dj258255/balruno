// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Collab token verification.
 *
 * The Spring backend issues short-lived (15 min) RS256 tokens via
 * POST /api/v1/auth/collab-token. The Hocuspocus server verifies the
 * token on every connection's onAuthenticate hook using the public
 * half of the issuer's RSA key pair — the private half stays on the
 * Spring side, so a leak in the collab runtime can't be used to forge
 * tokens. Audience claim `balruno-collab` separates these from API
 * session JWTs (audience `balruno-api`) issued from the same key.
 *
 * ADR 0002 v1.2 migrated from HS256-with-shared-secret to RS256;
 * `COLLAB_TOKEN_SECRET` (raw HMAC bytes) was replaced by
 * `COLLAB_TOKEN_PUBLIC_KEY` (PEM SPKI public key).
 */

import jwt from 'jsonwebtoken';

const PUBLIC_KEY = process.env.COLLAB_TOKEN_PUBLIC_KEY;
if (!PUBLIC_KEY) {
  throw new Error('COLLAB_TOKEN_PUBLIC_KEY environment variable is required');
}
// Normalise common shapes: env vars often arrive with literal `\n`
// escapes (.env loaders) or single-line stripped PEMs. jsonwebtoken's
// verify() wants the standard multi-line PEM block.
const PUBLIC_KEY_PEM = PUBLIC_KEY.includes('\\n')
  ? PUBLIC_KEY.replace(/\\n/g, '\n')
  : PUBLIC_KEY;

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
  const claims = jwt.verify(token, PUBLIC_KEY_PEM, {
    algorithms: ['RS256'],
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

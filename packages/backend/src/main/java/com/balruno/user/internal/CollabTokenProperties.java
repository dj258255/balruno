// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Bound from {@code balruno.collab.token.*}. Separate from
 * {@code balruno.jwt.*} because the collab token has a different
 * audience and a shorter TTL — but the RSA signing key is shared with
 * the main API JWT (ADR 0002 v1.2). The audience claim is what
 * separates the two surfaces, not a second key.
 *
 * Hocuspocus verifies these tokens on every WebSocket onAuthenticate
 * call using only the public key half — a leak of the Hocuspocus
 * runtime no longer compromises issuer integrity (the v1.1 HS256
 * scheme required sharing the secret with every verifier).
 *
 * Defaults:
 *   - ttl: 15 minutes — long enough for a single editor session to
 *     open without renewal, short enough that a leaked token is gone
 *     before a human can act on it.
 *   - audience: "balruno-collab" — the Hocuspocus server hard-codes
 *     this in its JWT verify call (packages/collab/src/auth.ts).
 */
@ConfigurationProperties(prefix = "balruno.collab.token")
record CollabTokenProperties(
        Duration ttl,
        String audience
) {}

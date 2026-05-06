// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Bound from {@code balruno.collab.token.*}. Separate from
 * {@code balruno.jwt.*} because the collab token has a different
 * audience, a shorter TTL, and — most importantly — is verified by the
 * Hocuspocus container, not by Spring's resource-server filter chain.
 *
 * Splitting the secrets matters: a leak on either surface (REST API
 * session vs. WebSocket collab handshake) shouldn't compromise the
 * other (ADR 0002 v1.1, ADR 0017 §2.6 거부 이유).
 *
 * Defaults:
 *   - ttl: 15 minutes — long enough for a single editor session to
 *     open without renewal, short enough that a leaked token is gone
 *     before a human can act on it.
 *   - audience: "balruno-collab" — the Hocuspocus server hard-codes
 *     this in its JWT verify call (packages/collab/src/auth.ts).
 */
@ConfigurationProperties(prefix = "balruno.collab.token")
public record CollabTokenProperties(
        String secret,
        Duration ttl,
        String audience
) {}

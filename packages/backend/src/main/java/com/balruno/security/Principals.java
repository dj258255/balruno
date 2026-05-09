// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.security;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/**
 * Cross-cutting helpers for resolving the authenticated principal
 * from a Spring Security {@link Jwt}. Lives in {@code shared.api}
 * because every controller (~22 files) used to repeat the same
 * {@code UUID.fromString(jwt.getSubject())} inline.
 *
 * Static utility (rather than a {@code @Component}) — the operation
 * is a pure function, no state, no Spring lifecycle. Static keeps
 * the call site short ({@code Principals.userId(jwt)}) and avoids
 * the DI ceremony for what is effectively one line of logic.
 *
 * If the JWT subject claim ever changes shape (e.g. moves to a
 * custom {@code uid} claim), this is the single seam to update.
 */
public final class Principals {

    private Principals() {}

    /**
     * Extract the authenticated user's id from the JWT subject claim.
     * The OAuth2 / refresh-token issuance pipeline (JwtIssuer)
     * guarantees subject is the user UUID, so this never returns
     * null — but throws {@link IllegalArgumentException} if the
     * claim is missing or malformed (which would be an internal
     * misconfiguration, not a user-facing 400).
     */
    public static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}

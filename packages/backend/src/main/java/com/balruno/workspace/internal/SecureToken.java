// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Helper for opaque tokens (workspace_invites at the moment, refresh
 * tokens later).
 *
 * Generation: 32 random bytes from {@link SecureRandom}, base64url-
 * encoded without padding (~43 chars). Storage: SHA-256 of the same
 * bytes — we keep the hash and forget the raw secret. A constant-time
 * comparison is used on lookup so timing attacks don't leak whether a
 * token prefix matches.
 */
final class SecureToken {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private SecureToken() {}

    static String generateRaw() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return URL_ENCODER.encodeToString(bytes);
    }

    static byte[] hash(String rawToken) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(rawToken.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory in every JDK — this branch is unreachable.
            throw new IllegalStateException(e);
        }
    }
}

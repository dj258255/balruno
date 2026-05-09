// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * CollabTokenService unit tests. The Hocuspocus side-car verifies these
 * tokens with a *separate* secret from {@link JwtProperties#secret()}
 * so the test suite double-checks audience/sub/doc claims that the
 * sidecar parses on every WebSocket open.
 */
class CollabTokenServiceTest {

    private static final String SECRET_BASE64 = Base64.getEncoder()
            .encodeToString(new byte[32]);  // 32 zero bytes — minimum HS256

    private CollabTokenService newService(Duration ttl, String audience) {
        var props = new CollabTokenProperties(SECRET_BASE64, ttl, audience);
        return new CollabTokenService(props);
    }

    @Nested
    @DisplayName("Happy")
    class Happy {

        @Test
        void issued_token_parses_with_hs256_signature() throws Exception {
            var token = newService(Duration.ofMinutes(15), "balruno-collab")
                    .issue(UUID.randomUUID(), UUID.randomUUID()).token();
            var parsed = SignedJWT.parse(token);
            assertThat(parsed.getHeader().getAlgorithm().getName()).isEqualTo("HS256");
        }

        @Test
        void subject_is_user_uuid_string() throws Exception {
            var userId = UUID.randomUUID();
            var token = newService(Duration.ofMinutes(15), "balruno-collab")
                    .issue(userId, UUID.randomUUID()).token();
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getSubject()).isEqualTo(userId.toString());
        }

        @Test
        void doc_claim_carries_document_uuid() throws Exception {
            var docId = UUID.randomUUID();
            var token = newService(Duration.ofMinutes(15), "balruno-collab")
                    .issue(UUID.randomUUID(), docId).token();
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getStringClaim("doc")).isEqualTo(docId.toString());
        }

        @Test
        void audience_matches_props() throws Exception {
            var token = newService(Duration.ofMinutes(15), "balruno-collab")
                    .issue(UUID.randomUUID(), UUID.randomUUID()).token();
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getAudience()).containsExactly("balruno-collab");
        }

        @Test
        void issued_result_exposes_expiry_matching_jwt_exp_claim() throws Exception {
            var ttl = Duration.ofMinutes(15);
            var result = newService(ttl, "balruno-collab")
                    .issue(UUID.randomUUID(), UUID.randomUUID());
            var claims = SignedJWT.parse(result.token()).getJWTClaimsSet();
            // expiresAt is exposed for the controller to set the
            // response cookie / TTL header — must agree with the token's
            // exp claim within a second.
            assertThat(claims.getExpirationTime().toInstant())
                    .isCloseTo(result.expiresAt(), org.assertj.core.api.Assertions.within(
                            1, java.time.temporal.ChronoUnit.SECONDS));
        }

        @Test
        void exp_lands_inside_configured_ttl_window() throws Exception {
            var before = java.time.Instant.now();
            var result = newService(Duration.ofMinutes(5), "balruno-collab")
                    .issue(UUID.randomUUID(), UUID.randomUUID());
            var after = java.time.Instant.now();
            assertThat(result.expiresAt())
                    .isBetween(before.plus(Duration.ofMinutes(5)).minusSeconds(1),
                               after.plus(Duration.ofMinutes(5)).plusSeconds(1));
        }
    }

    @Nested
    @DisplayName("Error")
    class Error {

        @Test
        void secret_below_32_bytes_fails_construction_with_clear_message() {
            // HS256 requires ≥256 bits = 32 bytes. Boot must fail fast,
            // not at first sign — operators chase the wrong cause when
            // the symptom is "auth handshake fails 6 hours after deploy".
            var shortSecret = Base64.getEncoder().encodeToString(new byte[16]);
            var props = new CollabTokenProperties(
                    shortSecret, Duration.ofMinutes(15), "balruno-collab");

            assertThatThrownBy(() -> new CollabTokenService(props))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("at least 32 bytes");
        }

        @Test
        void empty_secret_fails_construction() {
            var props = new CollabTokenProperties(
                    "", Duration.ofMinutes(15), "balruno-collab");
            assertThatThrownBy(() -> new CollabTokenService(props))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void non_base64_secret_fails_construction() {
            var props = new CollabTokenProperties(
                    "!!!not base64!!!", Duration.ofMinutes(15), "balruno-collab");
            assertThatThrownBy(() -> new CollabTokenService(props))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}

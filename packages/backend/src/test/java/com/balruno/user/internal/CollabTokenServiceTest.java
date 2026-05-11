// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CollabTokenService unit tests. The Hocuspocus side-car verifies these
 * tokens with the public half of the issuer's RSA key (ADR 0002 v1.2);
 * the test suite double-checks audience/sub/doc claims that the
 * sidecar parses on every WebSocket open.
 */
class CollabTokenServiceTest {

    private CollabTokenService newService(Duration ttl, String audience) {
        var jwtProps = new JwtProperties(
                TestRsaKeys.PRIVATE_KEY_PEM,
                TestRsaKeys.PUBLIC_KEY_PEM,
                "balruno-test",
                Duration.ofMinutes(15),
                Duration.ofDays(30),
                "balruno_session",
                ".balruno.test",
                "https://balruno.test");
        var collabProps = new CollabTokenProperties(ttl, audience);
        return new CollabTokenService(new JwtIssuer(jwtProps), collabProps);
    }

    @Nested
    @DisplayName("Happy")
    class Happy {

        @Test
        void issued_token_parses_with_rs256_signature() throws Exception {
            var token = newService(Duration.ofMinutes(15), "balruno-collab")
                    .issue(UUID.randomUUID(), UUID.randomUUID()).token();
            var parsed = SignedJWT.parse(token);
            assertThat(parsed.getHeader().getAlgorithm().getName()).isEqualTo("RS256");
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

    // Error cases that were exclusive to HS256 secret length (32-byte
    // minimum, base64 decodability) are dropped — RSA key parsing
    // failure modes live in JwtIssuer's constructor, which throws on
    // bad PEM before we ever reach this service.
}

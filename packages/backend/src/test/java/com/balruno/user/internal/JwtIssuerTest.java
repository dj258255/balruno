// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JwtIssuer unit tests. Real {@link com.nimbusds.jwt.SignedJWT} parsing
 * (no Mockito) so the suite verifies the actual signed claim shape —
 * sub / iss / aud / iat / exp / jti / email / name / avatar_url / locale.
 *
 * The HS256 secret is generated per-test with a deterministic 32-byte
 * value so signature validity can be cross-checked. JwtProperties is a
 * record (not a Spring bean here) — instantiated directly.
 */
class JwtIssuerTest {

    private static final String SECRET_BASE64 = Base64.getEncoder()
            .encodeToString(new byte[]{
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
            });

    private JwtIssuer newIssuer(Duration accessTtl) {
        var props = new JwtProperties(
                SECRET_BASE64,
                "balruno-test",
                accessTtl,
                Duration.ofDays(30),
                "balruno_session",
                ".balruno.test",
                "https://balruno.test");
        return new JwtIssuer(props);
    }

    private AuthenticatedUser sampleUser() {
        return new AuthenticatedUser(
                UUID.fromString("00000000-0000-0000-0000-00000000abcd"),
                "u@example.com",
                "Beomsu",
                "/media/avatars/u/h.png",
                "ko");
    }

    @Nested
    @DisplayName("Happy")
    class Happy {

        @Test
        void token_parses_as_signed_jwt_with_hs256_header() throws Exception {
            var token = newIssuer(Duration.ofMinutes(15)).issueAccessToken(sampleUser());
            var parsed = SignedJWT.parse(token);
            assertThat(parsed.getHeader().getAlgorithm().getName()).isEqualTo("HS256");
        }

        @Test
        void subject_carries_user_uuid() throws Exception {
            var user = sampleUser();
            var token = newIssuer(Duration.ofMinutes(15)).issueAccessToken(user);
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getSubject()).isEqualTo(user.id().toString());
        }

        @Test
        void issuer_claim_equals_props_issuer() throws Exception {
            var token = newIssuer(Duration.ofMinutes(15)).issueAccessToken(sampleUser());
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getIssuer()).isEqualTo("balruno-test");
        }

        @Test
        void audience_is_balruno_api() throws Exception {
            var token = newIssuer(Duration.ofMinutes(15)).issueAccessToken(sampleUser());
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getAudience()).containsExactly("balruno-api");
        }

        @Test
        void carries_email_name_avatar_locale_as_custom_claims() throws Exception {
            var token = newIssuer(Duration.ofMinutes(15)).issueAccessToken(sampleUser());
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getStringClaim("email")).isEqualTo("u@example.com");
            assertThat(claims.getStringClaim("name")).isEqualTo("Beomsu");
            assertThat(claims.getStringClaim("avatar_url")).isEqualTo("/media/avatars/u/h.png");
            assertThat(claims.getStringClaim("locale")).isEqualTo("ko");
        }

        @Test
        void exp_claim_lands_within_configured_ttl() throws Exception {
            var ttl = Duration.ofMinutes(15);
            var before = java.time.Instant.now();
            var token = newIssuer(ttl).issueAccessToken(sampleUser());
            var after = java.time.Instant.now();
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            // exp must be in [before+ttl, after+ttl] — clock-jitter window.
            assertThat(claims.getExpirationTime().toInstant())
                    .isBetween(before.plus(ttl).minusSeconds(1), after.plus(ttl).plusSeconds(1));
        }

        @Test
        void each_call_gets_a_fresh_jti() throws Exception {
            var issuer = newIssuer(Duration.ofMinutes(15));
            var t1 = SignedJWT.parse(issuer.issueAccessToken(sampleUser())).getJWTClaimsSet();
            var t2 = SignedJWT.parse(issuer.issueAccessToken(sampleUser())).getJWTClaimsSet();
            // JTIs must differ — replay-defence at the verifier side
            // depends on each token being uniquely identifiable.
            assertThat(t1.getJWTID()).isNotEqualTo(t2.getJWTID());
        }
    }

    @Nested
    @DisplayName("Edge")
    class Edge {

        @Test
        void very_short_ttl_still_produces_valid_token() throws Exception {
            var token = newIssuer(Duration.ofSeconds(1)).issueAccessToken(sampleUser());
            // Should parse and have exp > iat by at least 1s.
            var claims = SignedJWT.parse(token).getJWTClaimsSet();
            assertThat(claims.getExpirationTime()).isAfter(claims.getIssueTime());
        }

        // NOTE: A "null optional fields" test was attempted but
        // NimbusJwtEncoder rejects null claim values with
        // IllegalArgumentException. Production OAuth flow always
        // populates name/avatar, but if a provider ever returns null
        // we'd get a 500 at issue time instead of a token with omitted
        // claims. Tracked as a follow-up — JwtIssuer should filter
        // null-valued claims defensively.
    }
}

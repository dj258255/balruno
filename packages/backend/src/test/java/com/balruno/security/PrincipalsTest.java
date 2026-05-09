// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Principals helper tests. Trivial logic but the *seam* matters —
 * any future change to subject claim shape (e.g., move to a custom
 * "uid" claim) lands here, so a regression test ensures every
 * controller picks up the new behaviour atomically.
 */
class PrincipalsTest {

    @Test
    @DisplayName("subject claim parses into UUID")
    void valid_uuid_subject() {
        var id = UUID.randomUUID();
        var jwt = Jwt.withTokenValue("ignored")
                .header("alg", "HS256")
                .subject(id.toString())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        assertThat(Principals.userId(jwt)).isEqualTo(id);
    }

    @Test
    @DisplayName("malformed subject throws IllegalArgumentException — internal misconfiguration signal")
    void malformed_subject_throws() {
        var jwt = Jwt.withTokenValue("ignored")
                .header("alg", "HS256")
                .subject("not-a-uuid")
                .claim("sub", "not-a-uuid")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        assertThatThrownBy(() -> Principals.userId(jwt))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

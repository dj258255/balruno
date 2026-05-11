// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Issues short-lived collab JWTs that the Hocuspocus container verifies
 * on every WebSocket connection. Module-private since only the
 * neighbouring CollabTokenController calls it.
 *
 * Signs with the same RSA key pair as the main API JWT (ADR 0002 v1.2 —
 * RS256 + audience split). The {@code aud=balruno-collab} claim is what
 * distinguishes a collab token from an API token; Hocuspocus enforces
 * the audience check in {@code packages/collab/src/auth.ts}.
 *
 * Authorisation note: this service signs whatever {@code (userId, documentId)}
 * pair the controller hands it. The controller is the right place to
 * gate that pair against the workspace member list — Stage C
 * deliberately ships the issuer alone so the wiring matches the
 * AGPL-side policy (Hocuspocus verifies the signature, the API does
 * the membership check). The membership check is a follow-up tracked
 * in ADR 0017 §4 — landing it here right now would couple the user
 * module to the workspace + project + document chain before the
 * document directory exists.
 */
@Service
class CollabTokenService {

    private final NimbusJwtEncoder encoder;
    private final CollabTokenProperties props;

    CollabTokenService(JwtIssuer issuer, CollabTokenProperties props) {
        // Reuse the issuer's RSA-backed encoder — single source of truth
        // for the signing key, and any future key rotation only needs to
        // happen in one place (JwtIssuer constructor).
        this.encoder = issuer.encoder();
        this.props = props;
    }

    IssuedCollabToken issue(UUID userId, UUID documentId) {
        var now = Instant.now();
        var exp = now.plus(props.ttl());
        var claims = JwtClaimsSet.builder()
                .subject(userId.toString())
                .audience(List.of(props.audience()))
                .claim("doc", documentId.toString())
                .issuedAt(now)
                .expiresAt(exp)
                .id(UUID.randomUUID().toString())
                .build();
        var header = JwsHeader.with(SignatureAlgorithm.RS256).build();
        var token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedCollabToken(token, exp);
    }

    record IssuedCollabToken(String token, Instant expiresAt) {}
}

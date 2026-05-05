// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Issues self-signed JWTs over HS256 using the secret from vault. Spring
 * Security's resource server side wires up {@link org.springframework.security.oauth2.jwt.NimbusJwtDecoder}
 * separately — the encoder + decoder share the same key bytes via
 * {@link JwtProperties#secret()}.
 *
 * Algorithm choice (ADR 0002 + readme):
 *   - HS256 today, single-instance Spring app. Simpler key management.
 *   - RS256 + JWKS endpoint planned when Hocuspocus sidecar (B-5) needs
 *     to verify our tokens — separate verifier mustn't share the secret.
 */
@Component
class JwtIssuer {

    private final NimbusJwtEncoder encoder;
    private final JwtProperties props;

    JwtIssuer(JwtProperties props) {
        this.props = props;
        var keyBytes = Base64.getDecoder().decode(props.secret());
        var key = new SecretKeySpec(keyBytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    String issueAccessToken(AuthenticatedUser user) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(user.id().toString())
                .audience(java.util.List.of("balruno-api"))
                .issuedAt(now)
                .expiresAt(now.plus(props.accessTokenTtl()))
                .id(UUID.randomUUID().toString())
                .claim("email", user.email())
                .claim("name", user.name())
                .claim("avatar_url", user.avatarUrl())
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}

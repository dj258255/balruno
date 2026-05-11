// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Issues self-signed JWTs over RS256 (ADR 0002 v1.2). Spring Security's
 * resource server side wires up {@link org.springframework.security.oauth2.jwt.NimbusJwtDecoder}
 * separately — both consume the RSA key pair held by {@link JwtProperties}.
 *
 * Algorithm choice (ADR 0002 v1.2):
 *   - RS256 + asymmetric key pair so Hocuspocus (separate Node.js verifier)
 *     only needs the public key. The previous HS256 setup required the
 *     full secret on both sides, leaving issuer integrity coupled to
 *     the verifier surface.
 *   - Same RSA key pair signs both the main API JWT (audience
 *     "balruno-api") and the collab JWT (audience "balruno-collab").
 *     Audience split keeps the two surfaces distinguishable for the
 *     respective verifier filters; collab service reuses this encoder.
 */
@Component
class JwtIssuer {

    private final NimbusJwtEncoder encoder;
    private final JwtProperties props;

    JwtIssuer(JwtProperties props) {
        this.props = props;
        var rsaKey = new RSAKey.Builder(PemKeys.parsePublic(props.publicKey()))
                .privateKey(PemKeys.parsePrivate(props.privateKey()))
                .build();
        this.encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(rsaKey)));
    }

    String issueAccessToken(AuthenticatedUser user) {
        var now = Instant.now();
        var builder = JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(user.id().toString())
                .audience(java.util.List.of("balruno-api"))
                .issuedAt(now)
                .expiresAt(now.plus(props.accessTokenTtl()))
                .id(UUID.randomUUID().toString());
        // Filter null-valued optional claims — NimbusJwtEncoder rejects
        // null with IllegalArgumentException, so a provider returning
        // a null display name (rare GitHub case, GDPR-anonymised users)
        // would otherwise 500 the OAuth flow. Omitted claims are valid
        // JWT shape; downstream verifiers tolerate absence.
        addIfNotNull(builder, "email", user.email());
        addIfNotNull(builder, "name", user.name());
        addIfNotNull(builder, "avatar_url", user.avatarUrl());
        addIfNotNull(builder, "locale", user.locale());
        var header = JwsHeader.with(SignatureAlgorithm.RS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, builder.build())).getTokenValue();
    }

    /** Used by {@link CollabTokenService} to sign collab-audience JWTs
     * with the same key pair. Keeps RSA key management in one place. */
    NimbusJwtEncoder encoder() {
        return encoder;
    }

    private static void addIfNotNull(JwtClaimsSet.Builder builder, String key, Object value) {
        if (value != null) builder.claim(key, value);
    }
}

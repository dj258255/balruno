// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

/**
 * Issues short-lived collab JWTs that the Hocuspocus container verifies
 * on every WebSocket connection. Lives next to the user-module's
 * AuthenticatedUser surface so the controller can stay in
 * {@code internal} without re-exporting types.
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
public class CollabTokenService {

    private final byte[] keyBytes;
    private final CollabTokenProperties props;

    CollabTokenService(CollabTokenProperties props) {
        this.props = props;
        // Key is base64-encoded raw bytes (matches the JwtProperties /
        // packages/collab/auth.ts decoding). Verifying the format up-front
        // makes a misconfigured deploy fail fast at boot, not at first call.
        this.keyBytes = Base64.getDecoder().decode(props.secret());
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "balruno.collab.token.secret must decode to at least 32 bytes (HS256)");
        }
    }

    public IssuedCollabToken issue(UUID userId, UUID documentId) {
        var now = Instant.now();
        var exp = now.plus(props.ttl());
        var claims = new JWTClaimsSet.Builder()
                .subject(userId.toString())
                .audience(props.audience())
                .claim("doc", documentId.toString())
                .issueTime(Date.from(now))
                .expirationTime(Date.from(exp))
                .build();
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        try {
            jwt.sign(new MACSigner(keyBytes));
        } catch (JOSEException e) {
            throw new IllegalStateException("collab token signing failed", e);
        }
        return new IssuedCollabToken(jwt.serialize(), exp);
    }

    public record IssuedCollabToken(String token, Instant expiresAt) {}
}

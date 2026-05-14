// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

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
 * on every WebSocket connection. Module-private since only the
 * neighbouring CollabTokenController calls it.
 *
 * Authorisation note: this service signs whatever {@code (userId, documentId)}
 * pair the controller hands it. The membership gate lives one layer up
 * in {@code CollabTokenController} (which calls
 * {@code CollabAccessRepository.canUserAccessDocument} before delegating
 * here) — keeping the issuer free of the workspace + project + document
 * lookup chain.
 */
@Service
class CollabTokenService {

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

    IssuedCollabToken issue(UUID userId, UUID documentId) {
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

    record IssuedCollabToken(String token, Instant expiresAt) {}
}

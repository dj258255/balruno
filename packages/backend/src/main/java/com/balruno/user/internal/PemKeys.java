// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * PEM ↔ RSA key parsing. PKCS#8 for private, X.509/SPKI for public —
 * the formats {@code openssl genrsa | openssl pkcs8 -topk8 -nocrypt}
 * and {@code openssl rsa -pubout} produce by default.
 *
 * Caller passes the full PEM block (with BEGIN/END headers) as a Java
 * string, multi-line or stripped doesn't matter — internal whitespace
 * normalisation handles both shapes.
 */
final class PemKeys {

    private PemKeys() {}

    static RSAPrivateKey parsePrivate(String pem) {
        try {
            var stripped = pem
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            var bytes = Base64.getDecoder().decode(stripped);
            return (RSAPrivateKey) KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(bytes));
        } catch (Exception e) {
            throw new IllegalStateException("invalid RSA private key PEM", e);
        }
    }

    static RSAPublicKey parsePublic(String pem) {
        try {
            var stripped = pem
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            var bytes = Base64.getDecoder().decode(stripped);
            return (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(bytes));
        } catch (Exception e) {
            throw new IllegalStateException("invalid RSA public key PEM", e);
        }
    }
}

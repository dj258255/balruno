// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord.internal;

import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Security;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.HexFormat;

/**
 * Ed25519 signature verification for Discord interaction requests.
 *
 * Discord posts each interaction with two headers we have to verify:
 *   X-Signature-Ed25519     — hex-encoded 64-byte signature
 *   X-Signature-Timestamp   — unix seconds
 * The signed message = timestamp + raw body (concatenated).
 *
 * Public key is the workspace bot's "Application Public Key" string
 * from the Discord Developer Portal. It's the raw 32-byte Ed25519
 * key, hex-encoded. We wrap it into an X.509 SubjectPublicKeyInfo
 * structure to feed Java's KeyFactory — there's no shorter ceremony
 * supported by the JCA without rewriting the parser.
 */
final class Ed25519Verifier {

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    /** OID 1.3.101.112 — id-Ed25519 from RFC 8410. */
    private static final byte[] ED25519_OID_HEADER = {
            0x30, 0x2a,                         // SEQUENCE (42)
            0x30, 0x05,                         //   SEQUENCE (5)
            0x06, 0x03, 0x2b, 0x65, 0x70,       //     OID 1.3.101.112
            0x03, 0x21, 0x00,                   //   BIT STRING (33), 0 unused bits
    };

    private Ed25519Verifier() {}

    static boolean verify(String hexPublicKey, String hexSignature,
                          String timestamp, String rawBody) {
        try {
            byte[] keyBytes = HexFormat.of().parseHex(hexPublicKey);
            if (keyBytes.length != 32) return false;
            byte[] x509 = new byte[ED25519_OID_HEADER.length + 32];
            System.arraycopy(ED25519_OID_HEADER, 0, x509, 0, ED25519_OID_HEADER.length);
            System.arraycopy(keyBytes, 0, x509, ED25519_OID_HEADER.length, 32);
            PublicKey key = KeyFactory.getInstance("Ed25519")
                    .generatePublic(new X509EncodedKeySpec(x509));
            byte[] sig = HexFormat.of().parseHex(hexSignature);
            byte[] msg = (timestamp + rawBody).getBytes(java.nio.charset.StandardCharsets.UTF_8);
            Signature verifier = Signature.getInstance("Ed25519");
            verifier.initVerify(key);
            verifier.update(msg);
            return verifier.verify(sig);
        } catch (Exception e) {
            return false;
        }
    }
}

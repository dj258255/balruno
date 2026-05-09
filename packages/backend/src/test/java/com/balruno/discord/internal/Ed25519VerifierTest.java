// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord.internal;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Security;
import java.security.Signature;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ed25519Verifier unit tests. Round-trip with a real keypair (no
 * mocks) to verify the OID-header wrapper + signature check flow
 * end-to-end. The keypair is generated per-test so the test is
 * self-contained and doesn't carry test-only secrets.
 */
class Ed25519VerifierTest {

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    @Nested
    @DisplayName("verify — happy")
    class Happy {

        @Test
        void valid_signature_with_matching_pubkey_returns_true() throws Exception {
            var pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
            var pubHex = rawPubKeyHex(pair.getPublic());
            var sig = sign(pair.getPrivate(), "1700000000{\"type\":1}");

            var ok = Ed25519Verifier.verify(pubHex, sig, "1700000000", "{\"type\":1}");

            assertThat(ok).isTrue();
        }
    }

    @Nested
    @DisplayName("verify — error")
    class Error {

        @Test
        void wrong_signature_returns_false() throws Exception {
            var pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
            var pubHex = rawPubKeyHex(pair.getPublic());

            // Sign one message, claim it covers a different message.
            var sig = sign(pair.getPrivate(), "1700000000{\"type\":1}");
            var ok = Ed25519Verifier.verify(pubHex, sig, "1700000000", "{\"type\":2}");

            assertThat(ok).isFalse();
        }

        @Test
        void wrong_pubkey_returns_false() throws Exception {
            var alicePair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
            var bobPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
            var aliceSig = sign(alicePair.getPrivate(), "1700000000body");

            var ok = Ed25519Verifier.verify(rawPubKeyHex(bobPair.getPublic()),
                    aliceSig, "1700000000", "body");

            assertThat(ok).isFalse();
        }

        @Test
        void malformed_pubkey_returns_false() {
            var ok = Ed25519Verifier.verify("not-hex-at-all",
                    "00".repeat(64), "1700000000", "body");
            assertThat(ok).isFalse();
        }

        @Test
        void wrong_length_pubkey_returns_false() {
            // 16 bytes, not 32 — Ed25519 requires exactly 32.
            var ok = Ed25519Verifier.verify("00".repeat(16),
                    "00".repeat(64), "1700000000", "body");
            assertThat(ok).isFalse();
        }

        @Test
        void malformed_signature_returns_false() throws Exception {
            var pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
            var pubHex = rawPubKeyHex(pair.getPublic());

            var ok = Ed25519Verifier.verify(pubHex, "garbage",
                    "1700000000", "body");

            assertThat(ok).isFalse();
        }

        @Test
        void timestamp_tampering_invalidates_signature() throws Exception {
            // The signed message = timestamp + body. Changing the
            // timestamp after signing breaks verification — replay
            // defence relies on this.
            var pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
            var pubHex = rawPubKeyHex(pair.getPublic());
            var sig = sign(pair.getPrivate(), "1700000000body");

            var ok = Ed25519Verifier.verify(pubHex, sig, "1700000999", "body");

            assertThat(ok).isFalse();
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    /** Strip the X.509 SubjectPublicKeyInfo wrapper to get the bare 32 bytes. */
    private static String rawPubKeyHex(PublicKey key) {
        var encoded = key.getEncoded();
        // Last 32 bytes of the X.509-wrapped Ed25519 public key are
        // the raw key (header is 12 bytes, total 44 bytes).
        var raw = new byte[32];
        System.arraycopy(encoded, encoded.length - 32, raw, 0, 32);
        return HexFormat.of().formatHex(raw);
    }

    private static String sign(PrivateKey priv, String message) throws Exception {
        var sig = Signature.getInstance("Ed25519");
        sig.initSign(priv);
        sig.update(message.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(sig.sign());
    }
}

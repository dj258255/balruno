// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Bound from {@code balruno.jwt.*} in application.yml. Centralising these
 * keeps every consumer (issuer, decoder filter, success handler) reading
 * from one place.
 *
 * Keys are PEM-encoded RSA (PKCS#8 for private, X.509/SPKI for public) and
 * shared with the collab JWT issuer/verifier — audience claim distinguishes
 * the two surfaces. ADR 0002 v1.2: RS256 + audience split chosen over two
 * separate HS256 secrets so Hocuspocus only needs the public key.
 */
@ConfigurationProperties(prefix = "balruno.jwt")
record JwtProperties(
        String privateKey,
        String publicKey,
        String issuer,
        Duration accessTokenTtl,
        Duration refreshTokenTtl,
        String cookieName,
        String cookieDomain,
        String frontendRedirectBase
) {}

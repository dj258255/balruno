// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Bound from {@code balruno.jwt.*} in application.yml. Centralising these
 * keeps every consumer (issuer, decoder filter, success handler) reading
 * from one place.
 */
@ConfigurationProperties(prefix = "balruno.jwt")
record JwtProperties(
        String secret,
        String issuer,
        Duration accessTokenTtl,
        Duration refreshTokenTtl,
        String cookieName,
        String cookieDomain,
        String frontendRedirectBase
) {}

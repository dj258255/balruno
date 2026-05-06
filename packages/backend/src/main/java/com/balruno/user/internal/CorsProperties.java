// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Bound from {@code balruno.security.cors.*}. Centralises the cross-origin
 * policy so {@link SecurityConfig} doesn't hard-code domain lists — the
 * default in {@code application.yml} covers our own domains and local
 * dev, and self-host operators override the env without touching code.
 *
 * Override examples:
 *   - Spring env name: {@code BALRUNO_SECURITY_CORS_ALLOWED_ORIGIN_PATTERNS_0=https://my.example.com}
 *   - Or via application-<profile>.yml YAML list, which Spring Boot binds
 *     to {@code List<String>} natively.
 *
 * Wildcard origin (`*`) is intentionally not supported — {@code
 * allowCredentials=true} on the policy makes wildcard incompatible with
 * the browser CORS spec.
 */
@ConfigurationProperties(prefix = "balruno.security.cors")
record CorsProperties(List<String> allowedOriginPatterns) {}

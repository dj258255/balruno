// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

/**
 * Identifies which third-party OAuth provider a user authenticated through.
 *
 * The string values match the {@code oauth_provider} ENUM in V1 — keep
 * those two in sync. Adding a provider requires both a new enum constant
 * here AND a Flyway migration that {@code ALTER TYPE oauth_provider ADD VALUE}.
 *
 * Public to the {@code com.balruno.user} module; visible to other modules
 * because callers (e.g. an HTTP controller in B-2.3) need to switch on it.
 */
public enum OAuthProvider {
    GITHUB,
    GOOGLE
}

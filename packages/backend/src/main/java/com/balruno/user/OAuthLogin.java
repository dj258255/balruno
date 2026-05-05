// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

/**
 * Provider-neutral login payload — Spring Security's OAuth2User /
 * OidcUser principals get translated into this record before reaching
 * {@link UserAuthService}. Doing the translation at the boundary keeps
 * the user module ignorant of OAuth client internals (HTTP shape, scope
 * names, attribute keys) and gives tests one stable input contract.
 */
public record OAuthLogin(
        OAuthProvider provider,
        String providerUserId,
        String email,
        boolean emailVerified,
        String name,
        String avatarUrl
) {
    public OAuthLogin {
        if (provider == null) {
            throw new IllegalArgumentException("provider is required");
        }
        if (providerUserId == null || providerUserId.isBlank()) {
            throw new IllegalArgumentException("providerUserId is required");
        }
    }
}

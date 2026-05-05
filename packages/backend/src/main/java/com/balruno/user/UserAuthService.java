// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

import java.util.UUID;

/**
 * The user module's outbound API. Other modules (controllers in B-2.3,
 * future workspace / project modules) call this — never the JPA layer.
 */
public interface UserAuthService {

    /**
     * Resolves an inbound OAuth login to an {@link AuthenticatedUser},
     * applying the verified-email auto-link rule. Creates a user + an
     * oauth_account row when this is a brand-new identity, or links a new
     * provider to an existing user when the verified emails match.
     *
     * @throws UserAuthException with reason {@code UNVERIFIED_EMAIL_CONFLICT}
     *         when the provider's email matches an existing user but one
     *         side is unverified.
     */
    AuthenticatedUser findOrCreateOnOAuth(OAuthLogin login);

    /**
     * Loads a user by id — used by the JWT-authenticated request filter
     * to hydrate the principal on every API call.
     */
    AuthenticatedUser findById(UUID userId);
}

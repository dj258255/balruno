// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

import java.util.UUID;

/**
 * Public read model for an authenticated user. Returned by
 * {@link UserAuthService} after a successful OAuth login and surfaced to
 * controllers that need to populate JWT claims or response bodies.
 *
 * No persistence concerns leak through — JPA entities live in
 * {@code internal} and are never visible to other modules.
 */
public record AuthenticatedUser(
        UUID id,
        String email,
        String name,
        String avatarUrl,
        String locale
) {}

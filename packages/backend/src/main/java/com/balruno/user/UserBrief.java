// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

import java.util.UUID;

/**
 * Slimmed read model used by other modules that need to render a person —
 * member rows, comment authors, audit-log actors, presence labels. The
 * difference from {@link AuthenticatedUser}: brief is a *third-party*
 * view, fetched by id, with no locale (locale is the viewer's setting,
 * not the subject's). Email is included because it doubles as the
 * disambiguating handle when {@code name} is null.
 */
public record UserBrief(
        UUID id,
        String email,
        String name,
        String avatarUrl
) {}

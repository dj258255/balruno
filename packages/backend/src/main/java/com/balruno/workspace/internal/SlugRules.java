// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.WorkspaceException;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Slug policy — input format + reserved words in a single place.
 * Workspace / project / future namespace slugs all share this rule set.
 */
final class SlugRules {

    private SlugRules() {}

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9-]{2,29}$");

    /**
     * Names that collide with URL prefixes or general sensitive routes.
     * Any new top-level path should be added here too — a workspace slug
     * sharing a path with a system route makes routing ambiguous.
     */
    private static final Set<String> RESERVED = Set.of(
            "api", "app", "admin", "www", "balruno",
            "auth", "login", "logout", "oauth2", "signup",
            "actuator", "swagger-ui", "v3",
            "static", "assets", "public",
            "i", "w", "u", "p",        // reserve short path prefixes for future use
            "help", "support", "docs", "blog", "status",
            "settings", "billing", "team", "teams"
    );

    static void validate(String slug) {
        if (slug == null || !SLUG_PATTERN.matcher(slug).matches()) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.SLUG_INVALID,
                    "Slug must match [a-z0-9][a-z0-9-]{2,29}.");
        }
        if (RESERVED.contains(slug)) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.SLUG_RESERVED,
                    "This slug is reserved.");
        }
    }
}

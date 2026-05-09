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
     * Any new top-level path should be added here too — a workspace
     * slug sharing a path with a system route makes routing ambiguous.
     *
     * Linear-style URL migration (Phase 1) adds `/{wsSlug}` and
     * `/{wsSlug}/projects/{p}` and is preparing the ground for
     * `/{wsSlug}/{members,settings,audit,...}` workspace sub-resources.
     * Each second-level keyword is also reserved at the workspace-slug
     * level so a future ws-level page never collides with an existing
     * workspace's slug.
     */
    private static final Set<String> RESERVED = Set.of(
            // Top-level system routes / brand
            "api", "app", "admin", "www", "balruno",
            // Auth + OAuth
            "auth", "login", "logout", "oauth2", "signup", "callback",
            // Spring actuator + OpenAPI
            "actuator", "swagger-ui", "v3",
            // Static asset prefixes
            "static", "assets", "public",
            // Short prefixes reserved for future use (also covers the
            // legacy /w + /p paths)
            "i", "w", "u", "p",
            // Marketing + content surface
            "help", "support", "docs", "blog", "status",
            "pricing", "privacy", "terms", "about", "changelog",
            // Workspace-level sub-resources (Linear-style routing prep)
            "settings", "billing", "team", "teams", "workspace", "workspaces",
            "projects", "project", "members", "member",
            "audit", "audit-log", "inbox", "notifications",
            "integrations", "integration", "webhooks", "webhook",
            "discord", "share", "quota", "templates", "template",
            "trash", "search", "invites", "invite"
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

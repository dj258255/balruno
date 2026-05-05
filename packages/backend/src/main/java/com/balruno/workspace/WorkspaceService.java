// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import java.util.List;
import java.util.UUID;

/**
 * Outbound API of the workspace module. Other modules (controllers,
 * future project / sheet) call through here — the JPA layer stays
 * encapsulated.
 */
public interface WorkspaceService {

    /** Creates a workspace and registers the caller as OWNER. */
    Workspace create(UUID creatorUserId, String slug, String name);

    /**
     * Auto-creates a default workspace for a brand-new user. Picks an
     * available slug starting from {@code preferredSlugBase}, falling back
     * to numeric suffixes on collision.
     */
    Workspace createDefaultFor(UUID userId, String preferredSlugBase, String name);

    Workspace findById(UUID workspaceId);

    /** Looks up an active (non-soft-deleted) workspace by slug. */
    Workspace findBySlug(String slug);

    /** Workspaces the user is a member of (any role). */
    List<Workspace> listForUser(UUID userId);

    /**
     * Asserts the caller's role is at least {@code minRequired}. Throws
     * {@link WorkspaceException} with reason NOT_A_MEMBER or
     * INSUFFICIENT_ROLE on failure.
     */
    void requireRole(UUID workspaceId, UUID userId, WorkspaceRole minRequired);
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project;

import java.util.List;
import java.util.UUID;

/**
 * Outbound API of the project module.
 *
 * Authorisation: every method that takes a {@code callerUserId} delegates
 * to the workspace module's role check. Read paths require Viewer-or-
 * higher on the parent workspace; create / update / soft-delete require
 * Builder-or-higher because projects are structural (they hold sheets
 * and documents).
 */
public interface ProjectService {

    /** Create a project inside a workspace. Caller must be Builder+ on the workspace. */
    Project create(UUID workspaceId, UUID callerUserId,
                   String slug, String name, String description);

    /**
     * Create a project pre-populated with the starter pack (12 group
     * Notion-style sheet_tree, ADR 0020). Used by the onboarding
     * path; falls back to {@link #create}'s minimal Sheet 1 seed when
     * the catalog for the locale isn't loaded.
     *
     * {@code locale} resolves the language of the starter content
     * ("ko" / "en"); ko is the fallback when the requested locale's
     * catalog is missing.
     */
    Project createWithStarterPack(UUID workspaceId, UUID callerUserId,
                                  String slug, String name, String description,
                                  String locale);

    Project findById(UUID projectId, UUID callerUserId);

    /** Active projects of a workspace, oldest first. Caller must be Viewer+. */
    List<Project> listInWorkspace(UUID workspaceId, UUID callerUserId);

    /** Rename / re-slug / update description. Builder+. Null fields skipped. */
    Project update(UUID projectId, UUID callerUserId,
                   String newSlug, String newName, String newDescription);

    /** Soft-deletes the project. Builder+. */
    void softDelete(UUID projectId, UUID callerUserId);

    /**
     * Update a single project's lexorank sort_key. Used by the sidebar
     * drag-drop reorder. Caller must be Builder+ on the parent
     * workspace. The frontend computes the key as a midpoint between
     * the two siblings the project lands between, so collisions /
     * rebalances stay rare enough to not warrant a server-side
     * arithmetic generator. Server only validates length + alphabet.
     */
    Project updateSortKey(UUID projectId, UUID callerUserId, String newSortKey);

    /**
     * Active project count for quota readouts. Operator-internal: callers
     * are responsible for ensuring the user is allowed to see the
     * workspace before exposing this number.
     */
    long countActiveInWorkspace(UUID workspaceId);
}

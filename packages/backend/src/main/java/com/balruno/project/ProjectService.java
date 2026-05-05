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

    Project findById(UUID projectId, UUID callerUserId);

    /** Active projects of a workspace, oldest first. Caller must be Viewer+. */
    List<Project> listInWorkspace(UUID workspaceId, UUID callerUserId);

    /** Rename / re-slug / update description. Builder+. Null fields skipped. */
    Project update(UUID projectId, UUID callerUserId,
                   String newSlug, String newName, String newDescription);

    /** Soft-deletes the project. Builder+. */
    void softDelete(UUID projectId, UUID callerUserId);
}

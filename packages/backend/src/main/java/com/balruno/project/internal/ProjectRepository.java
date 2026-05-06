// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface ProjectRepository extends JpaRepository<ProjectEntity, UUID> {

    /** Active projects in a workspace, oldest first. */
    List<ProjectEntity> findByWorkspaceIdAndDeletedAtIsNullOrderByCreatedAtAsc(UUID workspaceId);

    boolean existsByWorkspaceIdAndSlugAndDeletedAtIsNull(UUID workspaceId, String slug);

    /** Active project count for the per-plan {@code maxProjectsPerWorkspace} guard. */
    long countByWorkspaceIdAndDeletedAtIsNull(UUID workspaceId);
}

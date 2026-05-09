// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface ProjectRepository extends JpaRepository<ProjectEntity, UUID> {

    /**
     * Active projects in a workspace, sorted by the V25 fractional
     * {@code sort_key} (lexorank). created_at is the tiebreaker so two
     * rows that ended up with the same key still land in a stable
     * deterministic order; the rebalance step in ProjectService keeps
     * collisions extremely rare in practice.
     */
    List<ProjectEntity> findByWorkspaceIdAndDeletedAtIsNullOrderBySortKeyAscCreatedAtAsc(UUID workspaceId);

    /** Largest active sort_key in the workspace — used to pick the
     *  next bottom slot when inserting a brand-new project. */
    @org.springframework.data.jpa.repository.Query(
        "select max(p.sortKey) from ProjectEntity p"
        + " where p.workspaceId = :wsId and p.deletedAt is null")
    java.util.Optional<String> findMaxSortKey(@org.springframework.data.repository.query.Param("wsId") UUID wsId);

    boolean existsByWorkspaceIdAndSlugAndDeletedAtIsNull(UUID workspaceId, String slug);

    /** Active project count for the per-plan {@code maxProjectsPerWorkspace} guard. */
    long countByWorkspaceIdAndDeletedAtIsNull(UUID workspaceId);
}

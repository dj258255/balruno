// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
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
    @Query(
        "select max(p.sortKey) from ProjectEntity p"
        + " where p.workspaceId = :wsId and p.deletedAt is null")
    Optional<String> findMaxSortKey(@Param("wsId") UUID wsId);

    boolean existsByWorkspaceIdAndSlugAndDeletedAtIsNull(UUID workspaceId, String slug);

    /** Active project count for the per-plan {@code maxProjectsPerWorkspace} guard. */
    long countByWorkspaceIdAndDeletedAtIsNull(UUID workspaceId);

    // ── Native ops for cross-region mutations (TemplateImportService, ──
    //    SheetDuplicateService) — both pull data + sheet_tree under FOR
    //    UPDATE then bump both versions atomically. The dedicated
    //    methods keep the raw SQL inside the repository file (R2).
    //    Mirrors the sync module's ProjectSyncRepository shape; the
    //    duplication is intentional — modulith keeps each module's SQL
    //    self-contained instead of crossing into sync.internal.

    @Query(value = """
                   SELECT data::text             AS data_json,
                          data_version           AS data_version,
                          sheet_tree::text       AS sheet_tree_json,
                          sheet_tree_version     AS sheet_tree_version
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                    FOR UPDATE
                   """,
           nativeQuery = true)
    Optional<DataAndSheetTreeRow> lockDataAndSheetTreeForUpdate(@Param("projectId") UUID projectId);

    interface DataAndSheetTreeRow {
        String getDataJson();
        long getDataVersion();
        String getSheetTreeJson();
        long getSheetTreeVersion();
    }

    @Modifying
    @Query(value = """
                   UPDATE projects
                      SET data               = CAST(:dataJson AS jsonb),
                          data_version       = :dataVersion,
                          sheet_tree         = CAST(:treeJson AS jsonb),
                          sheet_tree_version = :treeVersion,
                          updated_at         = now()
                    WHERE id = :projectId
                   """,
           nativeQuery = true)
    int updateDataAndSheetTree(@Param("projectId") UUID projectId,
                               @Param("dataJson") String dataJson,
                               @Param("dataVersion") long dataVersion,
                               @Param("treeJson") String treeJson,
                               @Param("treeVersion") long treeVersion);
}

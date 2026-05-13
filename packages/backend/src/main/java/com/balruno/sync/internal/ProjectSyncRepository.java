// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

/**
 * Sync-module persistence over the {@code projects} table — owns the
 * raw SELECT FOR UPDATE / UPDATE / JSONB column reads that the
 * op-log services (TreeOpService, SheetCellOpService, UndoServiceImpl,
 * ProjectStateLoader) used to issue inline via JdbcTemplate.
 *
 * Layering rule (feedback_no_jdbctemplate_in_new_code R2): all raw SQL
 * lives inside Repository files. ServiceImpl injects this repo and
 * calls methods only.
 *
 * Region columns (sheet_tree / doc_tree) are duplicated as separate
 * methods rather than parameterised — column names cannot be bound
 * via {@code :param}, and string interpolation would need a guarded
 * switch inside this class anyway. The duplication keeps each query
 * a static SQL string the JPA query parser can validate at boot.
 */
interface ProjectSyncRepository extends Repository<ProjectSyncEntity, UUID> {

    // ── ProjectStateLoader.loadFull (sync.full hydrate) ───────────────

    /**
     * Single-MVCC-window pull of all three op-log regions plus their
     * versions. The version triple is guaranteed coherent because
     * every read goes through one Postgres snapshot. Returns
     * {@code null} when the project doesn't exist or is soft-deleted.
     */
    @Query(value = """
                   SELECT data::text       AS data_json,
                          data_version     AS data_version,
                          sheet_tree::text AS sheet_tree_json,
                          sheet_tree_version AS sheet_tree_version,
                          doc_tree::text   AS doc_tree_json,
                          doc_tree_version AS doc_tree_version
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                   """,
           nativeQuery = true)
    Optional<FullStateRow> loadFullState(@Param("projectId") UUID projectId);

    interface FullStateRow {
        String getDataJson();
        long getDataVersion();
        String getSheetTreeJson();
        long getSheetTreeVersion();
        String getDocTreeJson();
        long getDocTreeVersion();
    }

    // ── TreeOpService.apply — SELECT FOR UPDATE per region ────────────

    @Query(value = """
                   SELECT sheet_tree::text     AS tree_json,
                          sheet_tree_version   AS tree_version
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                    FOR UPDATE
                   """,
           nativeQuery = true)
    Optional<TreeRow> lockSheetTreeForUpdate(@Param("projectId") UUID projectId);

    @Query(value = """
                   SELECT doc_tree::text       AS tree_json,
                          doc_tree_version     AS tree_version
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                    FOR UPDATE
                   """,
           nativeQuery = true)
    Optional<TreeRow> lockDocTreeForUpdate(@Param("projectId") UUID projectId);

    /**
     * Sheet-leaf-creation cross-region read — pulls sheet_tree + data
     * together so the FOR UPDATE locks both columns and the apply path
     * can update them in a single statement.
     */
    @Query(value = """
                   SELECT sheet_tree::text     AS tree_json,
                          sheet_tree_version   AS tree_version,
                          data::text           AS data_json,
                          data_version         AS data_version
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                    FOR UPDATE
                   """,
           nativeQuery = true)
    Optional<TreeAndDataRow> lockSheetTreeAndDataForUpdate(@Param("projectId") UUID projectId);

    interface TreeRow {
        String getTreeJson();
        long getTreeVersion();
    }

    interface TreeAndDataRow extends TreeRow {
        String getDataJson();
        long getDataVersion();
    }

    // ── TreeOpService.apply — UPDATE per region ───────────────────────

    @Modifying
    @Query(value = """
                   UPDATE projects
                      SET sheet_tree         = CAST(:treeJson AS jsonb),
                          sheet_tree_version = :treeVersion,
                          updated_at         = now()
                    WHERE id = :projectId
                   """,
           nativeQuery = true)
    int updateSheetTree(@Param("projectId") UUID projectId,
                        @Param("treeJson") String treeJson,
                        @Param("treeVersion") long treeVersion);

    @Modifying
    @Query(value = """
                   UPDATE projects
                      SET doc_tree         = CAST(:treeJson AS jsonb),
                          doc_tree_version = :treeVersion,
                          updated_at       = now()
                    WHERE id = :projectId
                   """,
           nativeQuery = true)
    int updateDocTree(@Param("projectId") UUID projectId,
                      @Param("treeJson") String treeJson,
                      @Param("treeVersion") long treeVersion);

    /** Sheet-leaf-creation cross-region UPDATE — sheet_tree + data in one shot. */
    @Modifying
    @Query(value = """
                   UPDATE projects
                      SET sheet_tree         = CAST(:treeJson AS jsonb),
                          sheet_tree_version = :treeVersion,
                          data               = CAST(:dataJson AS jsonb),
                          data_version       = :dataVersion,
                          updated_at         = now()
                    WHERE id = :projectId
                   """,
           nativeQuery = true)
    int updateSheetTreeWithData(@Param("projectId") UUID projectId,
                                @Param("treeJson") String treeJson,
                                @Param("treeVersion") long treeVersion,
                                @Param("dataJson") String dataJson,
                                @Param("dataVersion") long dataVersion);

    // ── SheetCellOpService.apply — projects.data SELECT FOR UPDATE ────

    @Query(value = """
                   SELECT data::text   AS data_json,
                          data_version AS data_version
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                    FOR UPDATE
                   """,
           nativeQuery = true)
    Optional<DataRow> lockDataForUpdate(@Param("projectId") UUID projectId);

    interface DataRow {
        String getDataJson();
        long getDataVersion();
    }

    @Modifying
    @Query(value = """
                   UPDATE projects
                      SET data         = CAST(:dataJson AS jsonb),
                          data_version = :dataVersion,
                          updated_at   = now()
                    WHERE id = :projectId
                   """,
           nativeQuery = true)
    int updateData(@Param("projectId") UUID projectId,
                   @Param("dataJson") String dataJson,
                   @Param("dataVersion") long dataVersion);

    // ── UndoServiceImpl — version-only reads per region ───────────────

    @Query(value = "SELECT data_version FROM projects "
                 + "WHERE id = :projectId AND deleted_at IS NULL",
           nativeQuery = true)
    Optional<Long> readDataVersion(@Param("projectId") UUID projectId);

    @Query(value = "SELECT sheet_tree_version FROM projects "
                 + "WHERE id = :projectId AND deleted_at IS NULL",
           nativeQuery = true)
    Optional<Long> readSheetTreeVersion(@Param("projectId") UUID projectId);

    @Query(value = "SELECT doc_tree_version FROM projects "
                 + "WHERE id = :projectId AND deleted_at IS NULL",
           nativeQuery = true)
    Optional<Long> readDocTreeVersion(@Param("projectId") UUID projectId);

    // ── Misc cross-aggregate lookups used by sync services ────────────

    @Query(value = "SELECT workspace_id FROM projects WHERE id = :projectId",
           nativeQuery = true)
    Optional<UUID> findWorkspaceId(@Param("projectId") UUID projectId);

    @Query(value = "SELECT name FROM projects WHERE id = :projectId AND deleted_at IS NULL",
           nativeQuery = true)
    Optional<String> findActiveName(@Param("projectId") UUID projectId);

    /**
     * Workspace plan for the per-plan limit guard on tree.add. Joins
     * across modules (workspaces ↔ projects) on a single PK so the
     * read is one round-trip; returns empty when the project is
     * soft-deleted or missing (the limit guard skips in that case
     * because the broader tree.add will fail on the lock read anyway).
     */
    @Query(value = """
                   SELECT w.plan::text
                     FROM workspaces w
                     JOIN projects p ON p.workspace_id = w.id
                    WHERE p.id = :projectId AND p.deleted_at IS NULL
                   """,
           nativeQuery = true)
    Optional<String> findActiveWorkspacePlanName(@Param("projectId") UUID projectId);

    /**
     * Membership probe used by {@code UndoController} to gate the
     * /v1/projects/{id}/undo,/redo,/undo-stack endpoints. Lives in the
     * sync slice rather than calling into {@code project.ProjectService}
     * because that would form a {@code project → sync → project}
     * dependency cycle (Spring Modulith ArchitectureTest rejects it).
     *
     * Returns {@code true} iff the project is active AND the caller is
     * a member of its workspace. Mirrors the same check the project
     * module's {@code findById(projectId, callerId)} performs, just
     * routed through one native query so the sync slice stays leaf.
     */
    @Query(value = """
                   SELECT EXISTS (
                     SELECT 1
                       FROM projects p
                       JOIN workspace_members m ON m.workspace_id = p.workspace_id
                      WHERE p.id = :projectId
                        AND p.deleted_at IS NULL
                        AND m.user_id = :userId
                   )
                   """,
           nativeQuery = true)
    boolean canUserAccessProject(@Param("projectId") UUID projectId,
                                  @Param("userId") UUID userId);
}

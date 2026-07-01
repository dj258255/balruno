// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence layer for the share_links table (ADR 0027). Spring
 * Data JPA over the entity, with a couple of derived-method finders
 * + native UPDATEs for the columns that don't go through Hibernate
 * dirty-checking (revoke / touch — single-column, no entity load).
 *
 * Service layer maps {@link ShareLinkEntity} → {@link com.balruno.share.ShareLink}
 * record at call sites that need the public DTO shape.
 */
interface ShareLinkRepository extends JpaRepository<ShareLinkEntity, UUID> {

    /** All links for a project, newest first (UI shows the list this way). */
    List<ShareLinkEntity> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    /**
     * Public-read lookup by token. The {@code revoked_at IS NULL}
     * predicate hits the partial index from V15 so this stays
     * index-only.
     */
    Optional<ShareLinkEntity> findByTokenAndRevokedAtIsNull(UUID token);

    /**
     * Single-column UPDATE — going through native @Modifying skips
     * the entity-load + dirty-check path Hibernate would otherwise
     * use, and keeps the WHERE clause's {@code revoked_at IS NULL}
     * idempotency guard explicit.
     */
    @Modifying
    @Query(value = "UPDATE share_links SET revoked_at = :now "
                 + " WHERE id = :id AND revoked_at IS NULL",
           nativeQuery = true)
    int revoke(@Param("id") UUID id, @Param("now") OffsetDateTime now);

    /**
     * Best-effort timestamp touch — the public read succeeds even if
     * the diagnostic UPDATE fails (caller wraps in try/catch).
     */
    @Modifying
    @Query(value = "UPDATE share_links SET last_used_at = :now WHERE id = :id",
           nativeQuery = true)
    int touchLastUsed(@Param("id") UUID id, @Param("now") OffsetDateTime now);

    /**
     * Public-read snapshot of a project for the share-link viewer.
     * Returns the same fields the WebSocket sync.full envelope carries
     * so the public viewer reuses the live sheet renderers unchanged.
     * Native query because we read the projects table (not share_links)
     * with raw JSONB columns, and the projection is shaped to drop the
     * service from going through ProjectSyncRepository (cross-module).
     */
    @Query(value = """
                   SELECT id::text                AS id,
                          name                    AS name,
                          data::text              AS data_json,
                          sheet_tree::text        AS sheet_tree_json,
                          data_version            AS data_version,
                          sheet_tree_version      AS sheet_tree_version
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                   """,
           nativeQuery = true)
    Optional<ProjectSnapshotRow> findProjectSnapshot(@Param("projectId") UUID projectId);

    interface ProjectSnapshotRow {
        String getId();
        String getName();
        String getDataJson();
        String getSheetTreeJson();
        long getDataVersion();
        long getSheetTreeVersion();
    }
}

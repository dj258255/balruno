// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence layer for project-wide search (ADR 0031). Pulled out
 * of {@link SearchController} so the controller stays a thin route +
 * walking-the-JSON layer.
 *
 * Queries lean on pg_trgm-indexed substring scans (see V21
 * project_search_indexes migration). Replace with tsvector + a
 * dedicated text column once search becomes hot enough that the
 * pg_trgm scan + JVM-side prune ceases to be adequate.
 *
 * Uses {@code Repository<ProjectEntity, UUID>} (the marker, not the
 * full JpaRepository) so derived methods (save / findAll) aren't
 * exposed — every method here is a typed native @Query. Two entities
 * mapping {@code projects} (this binding + the canonical ProjectEntity)
 * is fine because none of these queries load it as a managed entity.
 */
interface ProjectSearchRepository extends Repository<ProjectEntity, UUID> {

    /**
     * Project-level JSONB blob — single read, full doc returned for
     * application-side walking. Median project is well under 1 MB,
     * so loading the whole thing is faster than two round-trips.
     */
    @Query(value = """
                   SELECT data::text       AS data_text,
                          sheet_tree::text AS st_text
                     FROM projects
                    WHERE id = :projectId AND deleted_at IS NULL
                   """,
           nativeQuery = true)
    Optional<JsonBlobsRow> loadJsonBlobs(@Param("projectId") UUID projectId);

    interface JsonBlobsRow {
        String getDataText();
        String getStText();
    }

    /**
     * Comment hit list — capped at 50 rows to keep the panel
     * responsive. body_json::text scan uses the pg_trgm index from
     * V21. {@code pattern} carries the SQL ILIKE wildcards (e.g.
     * {@code "%foo%"}) supplied by the controller.
     */
    @Query(value = """
                   SELECT id            AS id,
                          project_id    AS projectId,
                          scope_kind    AS scopeKind,
                          sheet_id      AS sheetId,
                          row_id        AS rowId,
                          body_json::text AS bodyText
                     FROM comments
                    WHERE project_id = :projectId
                      AND deleted_at IS NULL
                      AND body_json::text ILIKE :pattern
                    LIMIT 50
                   """,
           nativeQuery = true)
    List<CommentHitRow> searchComments(@Param("projectId") UUID projectId,
                                       @Param("pattern") String pattern);

    interface CommentHitRow {
        UUID getId();
        UUID getProjectId();
        String getScopeKind();
        UUID getSheetId();
        UUID getRowId();
        String getBodyText();
    }
}

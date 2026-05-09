// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
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
 */
@Repository
class ProjectSearchRepository {

    private final JdbcTemplate jdbc;

    ProjectSearchRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Project-level JSONB blob — single read, full doc returned for
     * application-side walking. Median project is well under 1 MB,
     * so loading the whole thing is faster than two round-trips.
     */
    List<Map<String, Object>> loadJsonBlobs(UUID projectId) {
        return jdbc.queryForList(
                """
                SELECT data::text AS data_text, sheet_tree::text AS st_text,
                       doc_tree::text AS dt_text
                FROM projects
                WHERE id = ? AND deleted_at IS NULL
                """,
                projectId);
    }

    /**
     * Comment hit list — capped at 50 rows to keep the panel
     * responsive. body_json::text scan uses the pg_trgm index from
     * V21.
     */
    List<Map<String, Object>> searchComments(UUID projectId, String pattern) {
        return jdbc.queryForList(
                """
                SELECT id, project_id, scope_kind, sheet_id, row_id, document_id,
                       body_json::text AS body_text
                FROM comments
                WHERE project_id = ? AND deleted_at IS NULL
                  AND body_json::text ILIKE ?
                LIMIT 50
                """,
                projectId, pattern);
    }
}

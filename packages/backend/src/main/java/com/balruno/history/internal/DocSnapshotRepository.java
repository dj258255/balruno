// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.DocSnapshot;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class DocSnapshotRepository {

    private final JdbcTemplate jdbc;

    DocSnapshotRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Newest-first list of snapshot metadata for a doc, cut at the
     * caller-supplied retention timestamp. Hits {@code
     * doc_snapshots_doc_idx}.
     */
    List<DocSnapshot> listForDoc(UUID docId, OffsetDateTime cutoff, int limit) {
        return jdbc.query(
                "SELECT id, doc_id, project_id, actor_id, summary, created_at "
              + "FROM doc_snapshots "
              + "WHERE doc_id = ? AND created_at >= ? "
              + "ORDER BY created_at DESC "
              + "LIMIT ?",
                (rs, i) -> new DocSnapshot(
                        (UUID) rs.getObject("id"),
                        (UUID) rs.getObject("doc_id"),
                        (UUID) rs.getObject("project_id"),
                        (UUID) rs.getObject("actor_id"),
                        rs.getString("summary"),
                        rs.getObject("created_at", OffsetDateTime.class)),
                docId, cutoff, limit);
    }

    /**
     * Single-row metadata + project/doc ids for the auth check.
     * Returned without the bytes so the auth layer can decide before
     * we pay the BYTEA pull.
     */
    Optional<DocSnapshot> findById(UUID snapshotId) {
        try {
            var row = jdbc.queryForObject(
                    "SELECT id, doc_id, project_id, actor_id, summary, created_at "
                  + "FROM doc_snapshots WHERE id = ?",
                    (rs, i) -> new DocSnapshot(
                            (UUID) rs.getObject("id"),
                            (UUID) rs.getObject("doc_id"),
                            (UUID) rs.getObject("project_id"),
                            (UUID) rs.getObject("actor_id"),
                            rs.getString("summary"),
                            rs.getObject("created_at", OffsetDateTime.class)),
                    snapshotId);
            return Optional.ofNullable(row);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    Optional<byte[]> findStateBytes(UUID snapshotId) {
        try {
            return Optional.ofNullable(
                    jdbc.queryForObject(
                            "SELECT yjs_state FROM doc_snapshots WHERE id = ?",
                            byte[].class,
                            snapshotId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    /**
     * Resolves the project_id for a doc — the page-history list
     * needs it to look up the workspace plan + retention cutoff.
     */
    Optional<UUID> findProjectIdForDoc(UUID docId) {
        try {
            return Optional.ofNullable(
                    jdbc.queryForObject(
                            "SELECT project_id FROM documents WHERE id = ? AND deleted_at IS NULL",
                            UUID.class,
                            docId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}

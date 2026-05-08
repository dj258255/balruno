// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share.internal;

import com.balruno.share.ShareLink;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * JdbcTemplate backed store for share_links. Plain JDBC mirrors the
 * rest of the project's repository style (CommentRepository,
 * OpIdempotencyRepository) — JPA wouldn't add value for a 10-column
 * table with one composite read.
 */
@Repository
class ShareLinkRepository {

    private final JdbcTemplate jdbc;

    ShareLinkRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<ShareLink> ROW = (rs, i) -> new ShareLink(
            rs.getObject("id", UUID.class),
            rs.getObject("project_id", UUID.class),
            rs.getObject("sheet_id", UUID.class),
            rs.getString("active_view"),
            rs.getObject("token", UUID.class),
            getOffsetDateTime(rs, "expires_at"),
            getOffsetDateTime(rs, "revoked_at"),
            rs.getObject("created_by", UUID.class),
            getOffsetDateTime(rs, "created_at"),
            getOffsetDateTime(rs, "last_used_at")
    );

    private static OffsetDateTime getOffsetDateTime(ResultSet rs, String col) throws SQLException {
        var ts = rs.getTimestamp(col);
        return ts == null ? null : ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
    }

    ShareLink insert(UUID projectId, UUID sheetId, String activeView,
                     OffsetDateTime expiresAt, UUID createdBy) {
        // PK + token come from PG defaults (uuidv7() / gen_random_uuid()).
        // RETURNING gives the freshly-generated row in one round-trip.
        return jdbc.queryForObject(
                """
                INSERT INTO share_links (project_id, sheet_id, active_view, expires_at, created_by)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id, project_id, sheet_id, active_view, token,
                          expires_at, revoked_at, created_by, created_at, last_used_at
                """,
                ROW,
                projectId, sheetId, activeView,
                expiresAt == null ? null : java.sql.Timestamp.from(expiresAt.toInstant()),
                createdBy);
    }

    List<ShareLink> findByProjectId(UUID projectId) {
        return jdbc.query(
                """
                SELECT id, project_id, sheet_id, active_view, token,
                       expires_at, revoked_at, created_by, created_at, last_used_at
                FROM share_links
                WHERE project_id = ?
                ORDER BY created_at DESC
                """,
                ROW, projectId);
    }

    ShareLink findById(UUID id) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT id, project_id, sheet_id, active_view, token,
                           expires_at, revoked_at, created_by, created_at, last_used_at
                    FROM share_links WHERE id = ?
                    """,
                    ROW, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    /** Public-read lookup by token. Filter on revoked_at = NULL is in
     *  the partial index (V15) so the query is index-only. */
    ShareLink findActiveByToken(UUID token) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT id, project_id, sheet_id, active_view, token,
                           expires_at, revoked_at, created_by, created_at, last_used_at
                    FROM share_links
                    WHERE token = ? AND revoked_at IS NULL
                    """,
                    ROW, token);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    void revoke(UUID id, OffsetDateTime now) {
        jdbc.update(
                "UPDATE share_links SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
                java.sql.Timestamp.from(now.toInstant()), id);
    }

    /** Best-effort touch — failures don't propagate (the public read
     *  succeeds even if the diagnostic UPDATE fails). */
    void touchLastUsed(UUID id, OffsetDateTime now) {
        try {
            jdbc.update(
                    "UPDATE share_links SET last_used_at = ? WHERE id = ?",
                    java.sql.Timestamp.from(now.toInstant()), id);
        } catch (Exception ignored) {
            // Diagnostic — never block the read on it.
        }
    }
}

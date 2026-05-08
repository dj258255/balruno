// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook.internal;

import com.balruno.webhook.Webhook;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
class WebhookRepository {

    private final JdbcTemplate jdbc;

    WebhookRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Webhook> ROW = (rs, i) -> {
        var array = rs.getArray("events");
        var events = array == null ? List.<String>of() : List.of((String[]) array.getArray());
        return new Webhook(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("url"),
                events,
                rs.getObject("secret", UUID.class),
                rs.getBoolean("active"),
                ts(rs, "last_attempt_at"),
                (Integer) rs.getObject("last_status_code"),
                rs.getString("last_error"),
                rs.getObject("created_by", UUID.class),
                ts(rs, "created_at")
        );
    };

    private static OffsetDateTime ts(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant().atOffset(ZoneOffset.UTC);
    }

    Webhook insert(UUID projectId, String url, List<String> events, UUID createdBy) {
        return jdbc.execute((java.sql.Connection conn) -> {
            try (var ps = conn.prepareStatement(
                    """
                    INSERT INTO webhooks (project_id, url, events, created_by)
                    VALUES (?, ?, ?, ?)
                    RETURNING id, project_id, url, events, secret, active,
                              last_attempt_at, last_status_code, last_error,
                              created_by, created_at
                    """)) {
                Array arr = conn.createArrayOf("text", events.toArray(new String[0]));
                ps.setObject(1, projectId);
                ps.setString(2, url);
                ps.setArray(3, arr);
                ps.setObject(4, createdBy);
                try (var rs = ps.executeQuery()) {
                    if (!rs.next()) throw new IllegalStateException("insert returned no row");
                    return ROW.mapRow(rs, 1);
                }
            }
        });
    }

    List<Webhook> findByProjectId(UUID projectId) {
        return jdbc.query(
                """
                SELECT id, project_id, url, events, secret, active,
                       last_attempt_at, last_status_code, last_error,
                       created_by, created_at
                FROM webhooks
                WHERE project_id = ?
                ORDER BY created_at DESC
                """,
                ROW, projectId);
    }

    /** Active subscribers for a (project, event). Used by publish(). */
    List<Webhook> findActiveSubscribers(UUID projectId, String event) {
        return jdbc.query(
                """
                SELECT id, project_id, url, events, secret, active,
                       last_attempt_at, last_status_code, last_error,
                       created_by, created_at
                FROM webhooks
                WHERE project_id = ? AND active AND ? = ANY(events)
                """,
                ROW, projectId, event);
    }

    Webhook findById(UUID id) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT id, project_id, url, events, secret, active,
                           last_attempt_at, last_status_code, last_error,
                           created_by, created_at
                    FROM webhooks WHERE id = ?
                    """,
                    ROW, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    void setActive(UUID id, boolean active) {
        jdbc.update("UPDATE webhooks SET active = ? WHERE id = ?", active, id);
    }

    void delete(UUID id) {
        jdbc.update("DELETE FROM webhooks WHERE id = ?", id);
    }

    void recordAttempt(UUID id, OffsetDateTime now, Integer statusCode, String error) {
        jdbc.update(
                """
                UPDATE webhooks
                SET last_attempt_at = ?, last_status_code = ?, last_error = ?
                WHERE id = ?
                """,
                Timestamp.from(now.toInstant()),
                statusCode,
                error,
                id);
    }
}

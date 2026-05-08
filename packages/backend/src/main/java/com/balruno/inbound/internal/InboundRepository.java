// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound.internal;

import com.balruno.inbound.InboundWebhook;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
class InboundRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper nodeMapper = new ObjectMapper();

    InboundRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static OffsetDateTime ts(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant().atOffset(ZoneOffset.UTC);
    }

    private final RowMapper<InboundWebhook> ROW = (rs, i) -> {
        JsonNode mapping = null;
        var raw = rs.getString("column_mapping");
        if (raw != null) {
            try {
                mapping = nodeMapper.readTree(raw);
            } catch (Exception ignored) {
                // Malformed JSON in DB — degrade gracefully.
            }
        }
        return new InboundWebhook(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("provider"),
                rs.getObject("target_sheet_id", UUID.class),
                rs.getObject("secret", UUID.class),
                mapping,
                rs.getBoolean("active"),
                ts(rs, "last_received_at"),
                rs.getString("last_status"),
                rs.getString("last_error"),
                rs.getObject("created_by", UUID.class),
                ts(rs, "created_at")
        );
    };

    InboundWebhook insert(UUID projectId, String provider, UUID targetSheetId,
                          JsonNode columnMapping, UUID createdBy) {
        return jdbc.queryForObject(
                """
                INSERT INTO inbound_webhooks (project_id, provider, target_sheet_id, column_mapping, created_by)
                VALUES (?, ?, ?, ?::jsonb, ?)
                RETURNING id, project_id, provider, target_sheet_id, secret, column_mapping,
                          active, last_received_at, last_status, last_error,
                          created_by, created_at
                """,
                ROW,
                projectId, provider, targetSheetId,
                columnMapping == null ? null : columnMapping.toString(),
                createdBy);
    }

    List<InboundWebhook> findByProjectId(UUID projectId) {
        return jdbc.query(
                """
                SELECT id, project_id, provider, target_sheet_id, secret, column_mapping,
                       active, last_received_at, last_status, last_error,
                       created_by, created_at
                FROM inbound_webhooks
                WHERE project_id = ?
                ORDER BY created_at DESC
                """,
                ROW, projectId);
    }

    InboundWebhook findById(UUID id) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT id, project_id, provider, target_sheet_id, secret, column_mapping,
                           active, last_received_at, last_status, last_error,
                           created_by, created_at
                    FROM inbound_webhooks WHERE id = ?
                    """,
                    ROW, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    void delete(UUID id) {
        jdbc.update("DELETE FROM inbound_webhooks WHERE id = ?", id);
    }

    void recordReceive(UUID id, OffsetDateTime now, String status, String error) {
        jdbc.update(
                "UPDATE inbound_webhooks SET last_received_at = ?, last_status = ?, last_error = ? WHERE id = ?",
                Timestamp.from(now.toInstant()), status, error, id);
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit.internal;

import com.balruno.audit.AuditEntry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
class AuditRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper nodeMapper = new ObjectMapper();

    AuditRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private final RowMapper<AuditEntry> ROW = (rs, i) -> {
        JsonNode payload = null;
        var rawPayload = rs.getString("payload");
        if (rawPayload != null) {
            try { payload = nodeMapper.readTree(rawPayload); } catch (Exception ignored) {}
        }
        return new AuditEntry(
                rs.getObject("id", UUID.class),
                rs.getObject("workspace_id", UUID.class),
                rs.getObject("actor_user_id", UUID.class),
                rs.getString("action"),
                rs.getString("resource_type"),
                rs.getObject("resource_id", UUID.class),
                payload,
                ts(rs, "created_at"));
    };

    private static OffsetDateTime ts(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant().atOffset(ZoneOffset.UTC);
    }

    void insert(UUID workspaceId, UUID actorUserId, String action,
                String resourceType, UUID resourceId, JsonNode payload) {
        jdbc.update(
                """
                INSERT INTO workspace_audit_log
                    (workspace_id, actor_user_id, action, resource_type, resource_id, payload)
                VALUES (?, ?, ?, ?, ?, ?::jsonb)
                """,
                workspaceId, actorUserId, action, resourceType, resourceId,
                payload == null ? null : payload.toString());
    }

    List<AuditEntry> findByWorkspace(UUID workspaceId, int limit) {
        return jdbc.query(
                """
                SELECT id, workspace_id, actor_user_id, action, resource_type,
                       resource_id, payload::text AS payload, created_at
                FROM workspace_audit_log
                WHERE workspace_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                ROW, workspaceId, Math.min(Math.max(limit, 1), 500));
    }
}

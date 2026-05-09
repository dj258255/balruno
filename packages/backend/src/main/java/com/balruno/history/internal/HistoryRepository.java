// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.HistoryEntry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * cell_history reads + inserts (ADR 0038 Stage A).
 *
 * The row-scoped query hits the {@code cell_history_row_idx} partial
 * index (project_id, sheet_id, row_id, created_at DESC). The cutoff
 * predicate is a parameterised {@code created_at >= ?} — the caller
 * computes the timestamp from the workspace plan's
 * historyRetentionDays.
 */
@Repository
class HistoryRepository {

    private static final Logger log = LoggerFactory.getLogger(HistoryRepository.class);

    private final JdbcTemplate jdbc;
    // Spring Boot 4 autowires tools.jackson.databind.ObjectMapper, not the
    // fasterxml one — same trap CommentRepository hit earlier (memory:
    // project_sb4_abstractions). Construct a private fasterxml mapper so
    // the JSONB tree work here doesn't depend on Spring's autowire pick.
    private final ObjectMapper mapper = new ObjectMapper();

    HistoryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    void insert(UUID projectId, UUID sheetId, UUID rowId, UUID columnId,
                UUID actorId, String action, String payloadJson) {
        try {
            jdbc.update(
                    "INSERT INTO cell_history "
                  + "(project_id, sheet_id, row_id, column_id, actor_id, action, payload) "
                  + "VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)",
                    projectId, sheetId, rowId, columnId, actorId, action,
                    payloadJson != null ? payloadJson : null);
        } catch (DataAccessException e) {
            // Don't throw — history insert is best-effort. The user's
            // op already committed; a missing history row is annoying
            // but not data loss.
            log.warn("cell_history insert failed for action={} project={}", action, projectId, e);
        }
    }

    List<HistoryEntry> listForRow(UUID projectId, UUID sheetId, UUID rowId,
                                  OffsetDateTime cutoff, int limit) {
        return jdbc.query(
                "SELECT id, project_id, sheet_id, row_id, column_id, actor_id, action, "
              + "payload::text AS payload_json, created_at "
              + "FROM cell_history "
              + "WHERE project_id = ? AND sheet_id = ? AND row_id = ? "
              + "AND created_at >= ? "
              + "ORDER BY created_at DESC "
              + "LIMIT ?",
                this::map,
                projectId, sheetId, rowId, cutoff, limit);
    }

    List<HistoryEntry> listForSheet(UUID projectId, UUID sheetId,
                                    OffsetDateTime cutoff, int limit) {
        return jdbc.query(
                "SELECT id, project_id, sheet_id, row_id, column_id, actor_id, action, "
              + "payload::text AS payload_json, created_at "
              + "FROM cell_history "
              + "WHERE project_id = ? AND sheet_id = ? "
              + "AND created_at >= ? "
              + "ORDER BY created_at DESC "
              + "LIMIT ?",
                this::map,
                projectId, sheetId, cutoff, limit);
    }

    private HistoryEntry map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        var payloadJson = rs.getString("payload_json");
        var payload = payloadJson != null
                ? readJson(payloadJson)
                : null;
        return new HistoryEntry(
                (UUID) rs.getObject("id"),
                (UUID) rs.getObject("project_id"),
                (UUID) rs.getObject("sheet_id"),
                (UUID) rs.getObject("row_id"),
                (UUID) rs.getObject("column_id"),
                (UUID) rs.getObject("actor_id"),
                rs.getString("action"),
                payload,
                rs.getObject("created_at", OffsetDateTime.class));
    }

    private com.fasterxml.jackson.databind.JsonNode readJson(String s) {
        try {
            return mapper.readTree(s);
        } catch (Exception e) {
            log.warn("invalid payload jsonb in cell_history: {}", s, e);
            return null;
        }
    }
}

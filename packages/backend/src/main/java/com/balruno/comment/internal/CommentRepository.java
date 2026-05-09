// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import com.balruno.comment.Comment;
import com.fasterxml.jackson.databind.JsonNode;
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
 * JDBC repository for comments + mentions. Plain JdbcTemplate over
 * JPA — comment shape is read-mostly + the JSONB body is opaque
 * (Spring's JPA JSONB binding is awkward in v4 without the
 * Hibernate Types module).
 */
@Repository
class CommentRepository {

    private final JdbcTemplate jdbc;
    /**
     * Tree-mutation helper. Spring Boot 4 autowires {@code
     * tools.jackson.databind.ObjectMapper}, but JsonNode lives in
     * com.fasterxml — same dual-mapper pattern as SheetCellOpService
     * (memory: project_sb4_abstractions). nodeMapper is constructed
     * locally so the row mapper can readTree on the JSONB column.
     */
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    CommentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String BASE_SELECT =
            "SELECT id, project_id, scope_kind, sheet_id, row_id, column_id, "
          + "document_id, anchor_position, anchor_length, parent_id, author_user_id, "
          + "body_json::text AS body_json_text, resolved, resolved_by, "
          + "resolved_at, created_at, updated_at "
          + "FROM comments";

    private final RowMapper<Comment> rowMapper = new RowMapper<>() {
        @Override
        public Comment mapRow(ResultSet rs, int rowNum) throws SQLException {
            JsonNode body;
            try {
                body = nodeMapper.readTree(rs.getString("body_json_text"));
            } catch (Exception e) {
                throw new SQLException("malformed body_json", e);
            }
            return new Comment(
                    UUID.fromString(rs.getString("id")),
                    UUID.fromString(rs.getString("project_id")),
                    Comment.ScopeKind.valueOf(rs.getString("scope_kind")),
                    nullableUuid(rs.getString("sheet_id")),
                    nullableUuid(rs.getString("row_id")),
                    nullableUuid(rs.getString("column_id")),
                    nullableUuid(rs.getString("document_id")),
                    rs.getObject("anchor_position") == null ? null : rs.getInt("anchor_position"),
                    rs.getObject("anchor_length") == null ? null : rs.getInt("anchor_length"),
                    nullableUuid(rs.getString("parent_id")),
                    UUID.fromString(rs.getString("author_user_id")),
                    body,
                    rs.getBoolean("resolved"),
                    nullableUuid(rs.getString("resolved_by")),
                    rs.getObject("resolved_at", OffsetDateTime.class),
                    rs.getObject("created_at", OffsetDateTime.class),
                    rs.getObject("updated_at", OffsetDateTime.class));
        }
    };

    Comment insert(Comment c) {
        var bodyText = c.bodyJson().toString();
        jdbc.update(
                "INSERT INTO comments ("
              + "  id, project_id, scope_kind, sheet_id, row_id, column_id, "
              + "  document_id, anchor_position, anchor_length, parent_id, "
              + "  author_user_id, body_json"
              + ") VALUES (?, ?, ?::comment_scope_kind, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)",
                c.id(), c.projectId(), c.scopeKind().name(),
                c.sheetId(), c.rowId(), c.columnId(),
                c.documentId(), c.anchorPosition(), c.anchorLength(), c.parentId(),
                c.authorUserId(), bodyText);
        return findByIdOrThrow(c.id());
    }

    Comment findByIdOrThrow(UUID id) {
        try {
            return jdbc.queryForObject(
                    BASE_SELECT + " WHERE id = ? AND deleted_at IS NULL",
                    rowMapper, id);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("comment not found: " + id, e);
        }
    }

    Comment updateBody(UUID id, JsonNode bodyJson) {
        jdbc.update(
                "UPDATE comments SET body_json = ?::jsonb, updated_at = now() "
              + "WHERE id = ? AND deleted_at IS NULL",
                bodyJson.toString(), id);
        return findByIdOrThrow(id);
    }

    Comment setResolved(UUID id, boolean resolved, UUID resolvedBy) {
        if (resolved) {
            jdbc.update(
                    "UPDATE comments SET resolved = TRUE, resolved_by = ?, "
                  + "resolved_at = now(), updated_at = now() "
                  + "WHERE id = ? AND deleted_at IS NULL",
                    resolvedBy, id);
        } else {
            jdbc.update(
                    "UPDATE comments SET resolved = FALSE, resolved_by = NULL, "
                  + "resolved_at = NULL, updated_at = now() "
                  + "WHERE id = ? AND deleted_at IS NULL",
                    id);
        }
        return findByIdOrThrow(id);
    }

    void softDelete(UUID id) {
        jdbc.update(
                "UPDATE comments SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL",
                id);
    }

    List<Comment> listForCell(UUID projectId, UUID sheetId, UUID rowId, UUID columnId) {
        return jdbc.query(
                BASE_SELECT
              + " WHERE project_id = ? AND scope_kind = 'SHEET_CELL' "
              + "   AND sheet_id = ? AND row_id = ? AND column_id = ? "
              + "   AND deleted_at IS NULL "
              + " ORDER BY created_at",
                rowMapper, projectId, sheetId, rowId, columnId);
    }

    List<Comment> listForDoc(UUID projectId, UUID documentId) {
        return jdbc.query(
                BASE_SELECT
              + " WHERE project_id = ? AND scope_kind = 'DOC_BODY' "
              + "   AND document_id = ? "
              + "   AND deleted_at IS NULL "
              + " ORDER BY created_at",
                rowMapper, projectId, documentId);
    }

    List<Comment> listForProject(UUID projectId) {
        return jdbc.query(
                BASE_SELECT
              + " WHERE project_id = ? "
              + "   AND deleted_at IS NULL "
              + " ORDER BY created_at DESC LIMIT 200",
                rowMapper, projectId);
    }

    List<Comment> listUnreadMentions(UUID userId, int limit) {
        return jdbc.query(
                BASE_SELECT
              + " WHERE id IN (SELECT comment_id FROM mentions "
              + "              WHERE mentioned_user = ? AND notified = FALSE) "
              + "   AND deleted_at IS NULL "
              + " ORDER BY created_at DESC LIMIT ?",
                rowMapper, userId, limit);
    }

    List<Comment> listMentionsSinceForUser(UUID userId, java.time.OffsetDateTime since) {
        return jdbc.query(
                BASE_SELECT
              + " WHERE id IN (SELECT comment_id FROM mentions "
              + "              WHERE mentioned_user = ?) "
              + "   AND created_at >= ? "
              + "   AND deleted_at IS NULL "
              + " ORDER BY created_at DESC LIMIT 200",
                rowMapper, userId,
                java.sql.Timestamp.from(since.toInstant()));
    }

    /**
     * Resolve a (possibly soft-deleted) comment to its owning
     * workspace via project. Used by the Tier 2b orphan-cleanup
     * path so the storage counter decrement targets the right
     * workspace_storage row even when the comment row was
     * soft-deleted in the same transaction.
     */
    UUID workspaceIdOf(UUID commentId) {
        return jdbc.queryForObject(
                """
                SELECT p.workspace_id
                FROM comments c
                JOIN projects p ON p.id = c.project_id
                WHERE c.id = ?
                """,
                UUID.class, commentId);
    }

    void insertMentions(UUID commentId, List<UUID> mentionedUsers) {
        if (mentionedUsers.isEmpty()) return;
        // Batch insert; ignore conflicts so re-edit of a mention-bearing
        // comment doesn't error on the (comment_id, mentioned_user) PK.
        for (var userId : mentionedUsers) {
            jdbc.update(
                    "INSERT INTO mentions (comment_id, mentioned_user) "
                  + "VALUES (?, ?) ON CONFLICT DO NOTHING",
                    commentId, userId);
        }
    }

    private static UUID nullableUuid(String s) {
        return s == null ? null : UUID.fromString(s);
    }
}

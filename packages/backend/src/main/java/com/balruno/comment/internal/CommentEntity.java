// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import com.balruno.comment.Comment;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for comments (V11 + V12 anchor_length).
 *
 * scope_kind is a Postgres ENUM (comment_scope_kind) so it maps via
 * Enumerated.STRING + JdbcTypeCode.NAMED_ENUM, the same idiom used
 * across the workspace + sync modules.
 *
 * body_json is JSONB and binds via JdbcTypeCode.JSON — Hibernate 7
 * reads / writes JsonNode without an ObjectMapper round-trip.
 *
 * id / created_at use PG defaults (uuidv7, now); updated_at is
 * touched on every UPDATE via repository @Query so it's also marked
 * @Generated and treated as read-only from the JPA side.
 */
@Entity
@Table(name = "comments")
class CommentEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "scope_kind", nullable = false, updatable = false,
            columnDefinition = "comment_scope_kind")
    private Comment.ScopeKind scopeKind;

    @Column(name = "sheet_id", updatable = false)
    private UUID sheetId;

    @Column(name = "row_id", updatable = false)
    private UUID rowId;

    @Column(name = "column_id", updatable = false)
    private UUID columnId;

    @Column(name = "document_id", updatable = false)
    private UUID documentId;

    @Column(name = "anchor_position", updatable = false)
    private Integer anchorPosition;

    @Column(name = "anchor_length", updatable = false)
    private Integer anchorLength;

    @Column(name = "parent_id", updatable = false)
    private UUID parentId;

    @Column(name = "author_user_id", nullable = false, updatable = false)
    private UUID authorUserId;

    @Column(name = "body_json", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode bodyJson;

    @Column(name = "resolved", nullable = false)
    private boolean resolved;

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    protected CommentEntity() {} // JPA

    CommentEntity(UUID projectId, Comment.ScopeKind scopeKind,
                  UUID sheetId, UUID rowId, UUID columnId,
                  UUID documentId, Integer anchorPosition, Integer anchorLength,
                  UUID parentId, UUID authorUserId, JsonNode bodyJson) {
        this.projectId = projectId;
        this.scopeKind = scopeKind;
        this.sheetId = sheetId;
        this.rowId = rowId;
        this.columnId = columnId;
        this.documentId = documentId;
        this.anchorPosition = anchorPosition;
        this.anchorLength = anchorLength;
        this.parentId = parentId;
        this.authorUserId = authorUserId;
        this.bodyJson = bodyJson;
    }

    UUID getId() { return id; }

    Comment toDto() {
        return new Comment(
                id, projectId, scopeKind,
                sheetId, rowId, columnId,
                documentId, anchorPosition, anchorLength,
                parentId, authorUserId, bodyJson,
                resolved, resolvedBy, resolvedAt,
                createdAt, updatedAt);
    }
}

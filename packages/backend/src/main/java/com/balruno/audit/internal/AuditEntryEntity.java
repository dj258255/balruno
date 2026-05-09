// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit.internal;

import com.balruno.audit.AuditEntry;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for the workspace_audit_log table (ADR 0032).
 *
 * Append-only — there's no UPDATE path; entries are immutable once
 * written. JsonNode payload binds via {@code @JdbcTypeCode(JSON)}
 * so Hibernate 7 reads / writes the JSONB column natively without
 * the legacy ObjectMapper round-trip the JdbcTemplate version did.
 */
@Entity
@Table(name = "workspace_audit_log")
class AuditEntryEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "workspace_id", nullable = false, updatable = false)
    private UUID workspaceId;

    @Column(name = "actor_user_id", updatable = false)
    private UUID actorUserId;

    @Column(name = "action", nullable = false, updatable = false)
    private String action;

    @Column(name = "resource_type", updatable = false)
    private String resourceType;

    @Column(name = "resource_id", updatable = false)
    private UUID resourceId;

    @Column(name = "payload", columnDefinition = "jsonb", updatable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode payload;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected AuditEntryEntity() {} // JPA

    AuditEntryEntity(UUID workspaceId, UUID actorUserId, String action,
                     String resourceType, UUID resourceId, JsonNode payload) {
        this.workspaceId = workspaceId;
        this.actorUserId = actorUserId;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.payload = payload;
    }

    AuditEntry toDto() {
        return new AuditEntry(id, workspaceId, actorUserId, action,
                resourceType, resourceId, payload, createdAt);
    }
}

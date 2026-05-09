// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound.internal;

import com.balruno.inbound.InboundWebhook;
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
 * JPA mapping for the inbound_webhooks table (ADR 0029).
 *
 * id / secret / created_at / active default come from PG defaults
 * (uuidv7(), gen_random_uuid(), now(), true) — declared
 * insertable=false + @Generated so Hibernate skips them on INSERT
 * and reads them back via RETURNING.
 *
 * column_mapping is JSONB and binds via @JdbcTypeCode(JSON), which
 * lets Hibernate 7 handle JsonNode <-> jsonb without the manual
 * ObjectMapper round-trip the JdbcTemplate version did.
 */
@Entity
@Table(name = "inbound_webhooks")
class InboundWebhookEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "provider", nullable = false, updatable = false)
    private String provider;

    @Column(name = "target_sheet_id", nullable = false, updatable = false)
    private UUID targetSheetId;

    @Generated(event = EventType.INSERT)
    @Column(name = "secret", nullable = false, updatable = false, insertable = false)
    private UUID secret;

    @Column(name = "column_mapping", columnDefinition = "jsonb", updatable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode columnMapping;

    @Generated(event = EventType.INSERT)
    @Column(name = "active", nullable = false, insertable = false)
    private boolean active;

    @Column(name = "last_received_at")
    private OffsetDateTime lastReceivedAt;

    @Column(name = "last_status")
    private String lastStatus;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected InboundWebhookEntity() {} // JPA

    InboundWebhookEntity(UUID projectId, String provider, UUID targetSheetId,
                          JsonNode columnMapping, UUID createdBy) {
        this.projectId = projectId;
        this.provider = provider;
        this.targetSheetId = targetSheetId;
        this.columnMapping = columnMapping;
        this.createdBy = createdBy;
    }

    InboundWebhook toDto() {
        return new InboundWebhook(
                id, projectId, provider, targetSheetId, secret,
                columnMapping, active, lastReceivedAt, lastStatus,
                lastError, createdBy, createdAt);
    }
}

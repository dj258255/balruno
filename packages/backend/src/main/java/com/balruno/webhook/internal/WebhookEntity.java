// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook.internal;

import com.balruno.webhook.Webhook;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * JPA mapping for the webhooks table (ADR 0028).
 *
 * The {@code events} column is a Postgres TEXT[]. Hibernate 7 binds
 * String[] via @JdbcTypeCode(ARRAY); the entity stores the raw
 * String[] and the toDto() converts to List<String> for the public
 * record. Going through String[] (not List<String>) is deliberate:
 * Hibernate's ARRAY binding is tied to the JDBC array protocol,
 * which only round-trips real Java arrays.
 *
 * id / secret / active / created_at use PG defaults (uuidv7,
 * gen_random_uuid, true, now) — declared insertable=false +
 * @Generated so Hibernate skips them on INSERT and reads via
 * RETURNING.
 */
@Entity
@Table(name = "webhooks")
class WebhookEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "url", nullable = false, updatable = false)
    private String url;

    @Column(name = "events", nullable = false, updatable = false, columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] events;

    @Generated(event = EventType.INSERT)
    @Column(name = "secret", nullable = false, updatable = false, insertable = false)
    private UUID secret;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "last_attempt_at")
    private OffsetDateTime lastAttemptAt;

    @Column(name = "last_status_code")
    private Integer lastStatusCode;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected WebhookEntity() {} // JPA

    WebhookEntity(UUID projectId, String url, List<String> events, UUID createdBy) {
        this.projectId = projectId;
        this.url = url;
        this.events = events.toArray(new String[0]);
        this.createdBy = createdBy;
        this.active = true;
    }

    Webhook toDto() {
        return new Webhook(
                id, projectId, url,
                events == null ? List.of() : List.of(events),
                secret, active, lastAttemptAt, lastStatusCode, lastError,
                createdBy, createdAt);
    }
}

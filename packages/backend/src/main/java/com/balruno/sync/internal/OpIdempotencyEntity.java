// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Cached result of a previously-processed op, keyed by the client's
 * {@code clientMsgId}. ADR 0008 v2.0 §3.3 — when the client reconnects
 * mid-flight and replays an op, we return the cached version+payload
 * instead of re-applying.
 *
 * 7-day retention via separate cron (ADR 0017 Stage post-G follow-up).
 */
@Entity
@Table(name = "op_idempotency")
class OpIdempotencyEntity {

    @Id
    @Column(name = "client_msg_id", nullable = false, updatable = false)
    private UUID clientMsgId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "scope_kind", nullable = false, updatable = false, columnDefinition = "op_scope_kind")
    private OpScopeKind scopeKind;

    @Column(name = "scope_id", nullable = false, updatable = false)
    private UUID scopeId;

    @Column(name = "result_version", nullable = false, updatable = false)
    private long resultVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_payload", columnDefinition = "jsonb")
    private String resultPayload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected OpIdempotencyEntity() {}

    OpIdempotencyEntity(UUID clientMsgId, UUID userId, OpScopeKind scopeKind,
                        UUID scopeId, long resultVersion, String resultPayload) {
        this.clientMsgId = clientMsgId;
        this.userId = userId;
        this.scopeKind = scopeKind;
        this.scopeId = scopeId;
        this.resultVersion = resultVersion;
        this.resultPayload = resultPayload;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getClientMsgId()         { return clientMsgId; }
    public UUID getUserId()              { return userId; }
    public OpScopeKind getScopeKind()    { return scopeKind; }
    public UUID getScopeId()             { return scopeId; }
    public long getResultVersion()       { return resultVersion; }
    public String getResultPayload()     { return resultPayload; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}

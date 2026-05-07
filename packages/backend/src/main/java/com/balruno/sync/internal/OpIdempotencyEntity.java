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

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Cached result of a previously-processed op, keyed by the client's
 * {@code clientMsgId}. ADR 0008 v2.0 §3.3 — when the client reconnects
 * mid-flight and replays an op, we return the cached version+payload
 * instead of re-applying.
 *
 * V14 (ADR 0021 v2.3 Phase 5) added Pattern C undo columns:
 * inversePayload + reversibleUntil + isUndone + actionGroupId +
 * clientSessionId + projectId. The same row now serves both:
 *   - wire-level idempotency cache (V8 original purpose)
 *   - server-backed undo/redo log (Pattern C)
 *
 * 7-day retention via separate cron — undoable rows beyond
 * reversible_until still serve as idempotency cache until the
 * 5-minute cleanup interval (Baserow OLD_ACTION_CLEANUP_INTERVAL_MINUTES)
 * sweeps them.
 */
@Entity
@Table(name = "op_idempotency")
class OpIdempotencyEntity {

    /** Baserow MINUTES_UNTIL_ACTION_CLEANED_UP default — same across all
     *  tiers (free / Premium / Advanced) per upstream design. */
    static final Duration UNDO_WINDOW = Duration.ofMinutes(120);

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

    // ── V14 (Pattern C undo) — ADR 0021 Phase 5 ──────────────────────

    /** Array of forward ops (UndoableOp[] in frontend type). Client sends
     *  at emit time. Used by redo to re-apply the original action. Null
     *  means idempotency cache only (V8 originals, not undoable). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "forward_payload", columnDefinition = "jsonb")
    private String forwardPayload;

    /** Array of inverse ops (UndoableOp[] in frontend type). Client sends
     *  at emit time. Null means the op has no inverse (presence etc.) and
     *  is not undoable. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "inverse_payload", columnDefinition = "jsonb")
    private String inversePayload;

    /** Cmd+Z window end. Null means not reversible. */
    @Column(name = "reversible_until")
    private OffsetDateTime reversibleUntil;

    /** Already-undone rows are excluded from new undo lookups but kept
     *  for redo (popping the redo stack flips this back to false). */
    @Column(name = "is_undone", nullable = false)
    private boolean undone;

    @Column(name = "undone_at")
    private OffsetDateTime undoneAt;

    /** Client-driven action group id (Baserow ClientUndoRedoActionGroupId
     *  HTTP header pattern). Same group is undone in one Cmd+Z press. */
    @Column(name = "action_group_id")
    private UUID actionGroupId;

    /** Per-tab UUID generated on frontend mount. Cmd+Z only sees own
     *  session (Baserow per-tab pattern). */
    @Column(name = "client_session_id")
    private UUID clientSessionId;

    /** Direct project reference — undo lookup hot path avoids
     *  scope_kind / scope_id indirection. */
    @Column(name = "project_id")
    private UUID projectId;

    protected OpIdempotencyEntity() {}

    /**
     * Original V8 constructor — kept for the existing call sites that
     * don't yet send undo-related fields. Behaves as if the op is not
     * undoable (forwardPayload + inversePayload null + reversibleUntil null).
     */
    OpIdempotencyEntity(UUID clientMsgId, UUID userId, OpScopeKind scopeKind,
                        UUID scopeId, long resultVersion, String resultPayload) {
        this(clientMsgId, userId, scopeKind, scopeId, resultVersion, resultPayload,
             null, null, null, null, null);
    }

    /**
     * V14 constructor — full Pattern C metadata. Use this from the new
     * op-write paths once they thread the forward + inverse payloads +
     * actionGroupId + clientSessionId from the wire message.
     *
     * @param projectId       the project the op mutates (for undo lookup)
     * @param forwardPayload  JSONB array of the original ops, used by redo
     * @param inversePayload  JSONB array of inverse ops, used by undo
     * @param actionGroupId   client-driven group id, or null
     * @param clientSessionId per-tab session, or null
     */
    OpIdempotencyEntity(UUID clientMsgId, UUID userId, OpScopeKind scopeKind,
                        UUID scopeId, long resultVersion, String resultPayload,
                        UUID projectId,
                        String forwardPayload, String inversePayload,
                        UUID actionGroupId, UUID clientSessionId) {
        this.clientMsgId = clientMsgId;
        this.userId = userId;
        this.scopeKind = scopeKind;
        this.scopeId = scopeId;
        this.resultVersion = resultVersion;
        this.resultPayload = resultPayload;
        this.projectId = projectId;
        this.forwardPayload = forwardPayload;
        this.inversePayload = inversePayload;
        // reversibleUntil is set on @PrePersist if inversePayload is non-null.
        this.actionGroupId = actionGroupId;
        this.clientSessionId = clientSessionId;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        // An op is reversible iff it carries an inverse_payload.
        // Setting reversible_until on persist (instead of accepting it
        // from the constructor) makes the 120-min Baserow default
        // tamper-proof — clients can't extend their own window.
        if (this.inversePayload != null && this.reversibleUntil == null) {
            this.reversibleUntil = this.createdAt.plus(UNDO_WINDOW);
        }
    }

    public UUID getClientMsgId()           { return clientMsgId; }
    public UUID getUserId()                { return userId; }
    public OpScopeKind getScopeKind()      { return scopeKind; }
    public UUID getScopeId()               { return scopeId; }
    public long getResultVersion()         { return resultVersion; }
    public String getResultPayload()       { return resultPayload; }
    public OffsetDateTime getCreatedAt()   { return createdAt; }

    public String getForwardPayload()           { return forwardPayload; }
    public String getInversePayload()           { return inversePayload; }
    public OffsetDateTime getReversibleUntil()  { return reversibleUntil; }
    public boolean isUndone()                   { return undone; }
    public OffsetDateTime getUndoneAt()         { return undoneAt; }
    public UUID getActionGroupId()              { return actionGroupId; }
    public UUID getClientSessionId()            { return clientSessionId; }
    public UUID getProjectId()                  { return projectId; }

    /** Mark this entity as undone — flips is_undone + sets undone_at.
     *  Used by UndoService when applying inverse. */
    void markUndone() {
        this.undone = true;
        this.undoneAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    /** Reverse markUndone — used by redo. */
    void markRedone() {
        this.undone = false;
        this.undoneAt = null;
    }
}

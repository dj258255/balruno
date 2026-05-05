// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.WorkspaceRole;
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
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Persisted invite. Only the SHA-256 hash of the opaque secret lives
 * here — the raw token is returned to the inviter exactly once and
 * never recoverable from the database.
 */
@Entity
@Table(name = "workspace_invites")
class WorkspaceInviteEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "workspace_id", nullable = false, updatable = false)
    private UUID workspaceId;

    @Column(name = "invited_by", nullable = false, updatable = false)
    private UUID invitedBy;

    @Column(name = "token_hash", nullable = false, updatable = false, unique = true)
    private byte[] tokenHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "role", nullable = false, columnDefinition = "workspace_role")
    private WorkspaceRole role;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "accepted_by")
    private UUID acceptedBy;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    protected WorkspaceInviteEntity() {}

    WorkspaceInviteEntity(UUID workspaceId, UUID invitedBy, byte[] tokenHash,
                          WorkspaceRole role, OffsetDateTime expiresAt) {
        this.workspaceId = workspaceId;
        this.invitedBy = invitedBy;
        this.tokenHash = tokenHash;
        this.role = role;
        this.expiresAt = expiresAt;
    }

    public UUID getId() { return id; }
    public UUID getWorkspaceId() { return workspaceId; }
    public UUID getInvitedBy() { return invitedBy; }
    public WorkspaceRole getRole() { return role; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public OffsetDateTime getAcceptedAt() { return acceptedAt; }
    public UUID getAcceptedBy() { return acceptedBy; }
    public OffsetDateTime getRevokedAt() { return revokedAt; }

    boolean isActive(OffsetDateTime now) {
        return acceptedAt == null && revokedAt == null && expiresAt.isAfter(now);
    }

    void markAccepted(UUID userId) {
        this.acceptedAt = OffsetDateTime.now(ZoneOffset.UTC);
        this.acceptedBy = userId;
    }

    void revoke() {
        if (this.revokedAt == null) {
            this.revokedAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }
}

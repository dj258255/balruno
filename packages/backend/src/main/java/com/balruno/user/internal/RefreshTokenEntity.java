// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Persisted refresh token, identified by the SHA-256 hash of an opaque
 * 32-byte secret. The raw secret never lives in this row — V1 enforces the
 * unique index on {@code token_hash} so theft detection (a re-use of a
 * revoked secret) is reducible to a single equality lookup.
 *
 * Rotation: on {@code /token/refresh}, the service inserts a new row with
 * {@code prev_id} pointing at the consumed one and sets the consumed row's
 * {@code revoked_at}. Reuse of the consumed secret afterwards is the signal
 * that the chain has been compromised — wired in B-2.3.
 */
@Entity
@Table(name = "refresh_tokens")
class RefreshTokenEntity {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private byte[] tokenHash;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private OffsetDateTime issuedAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "prev_id")
    private UUID prevId;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    // ip_address column is INET in PG. We let it round-trip as a string
    // for now — if we need subnet matching later, switch to inet-aware type.
    @Column(name = "ip_address", columnDefinition = "inet")
    private String ipAddress;

    protected RefreshTokenEntity() { /* JPA */ }

    RefreshTokenEntity(UUID userId, byte[] tokenHash, OffsetDateTime expiresAt,
                       UUID prevId, String userAgent, String ipAddress) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.prevId = prevId;
        this.userAgent = userAgent;
        this.ipAddress = ipAddress;
    }

    @PrePersist
    void onCreate() {
        this.issuedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public byte[] getTokenHash() { return tokenHash; }
    public OffsetDateTime getIssuedAt() { return issuedAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public OffsetDateTime getRevokedAt() { return revokedAt; }
    public UUID getPrevId() { return prevId; }

    boolean isRevoked() { return revokedAt != null; }

    void revoke() {
        if (this.revokedAt == null) {
            this.revokedAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }
}

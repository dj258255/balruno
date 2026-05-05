// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.OAuthProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Links a {@link UserEntity} to a third-party OAuth identity. A single user
 * can have many oauth_accounts (one per provider) — the linking decision
 * lives in {@link OAuthLinkRule} so this class only models the row.
 */
@Entity
@Table(name = "oauth_accounts")
class OAuthAccountEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    // Map the Java enum name onto the PG ENUM via NAMED_ENUM — Hibernate 7
    // emits {@code CAST(? AS oauth_provider)} so the string literal lands in
    // the typed column without a string→enum cast in every query.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "provider", nullable = false, columnDefinition = "oauth_provider")
    private OAuthProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 120)
    private String providerUserId;

    @Column(name = "provider_email", length = 254)
    private String providerEmail;

    @Column(name = "provider_email_verified", nullable = false)
    private boolean providerEmailVerified;

    @Column(name = "linked_at", nullable = false, updatable = false)
    private OffsetDateTime linkedAt;

    protected OAuthAccountEntity() { /* JPA */ }

    OAuthAccountEntity(UUID userId, OAuthProvider provider, String providerUserId,
                       String providerEmail, boolean providerEmailVerified) {
        this.userId = userId;
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.providerEmail = providerEmail;
        this.providerEmailVerified = providerEmailVerified;
    }

    @PrePersist
    void onCreate() {
        this.linkedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public OAuthProvider getProvider() { return provider; }
    public String getProviderUserId() { return providerUserId; }
    public String getProviderEmail() { return providerEmail; }
    public boolean isProviderEmailVerified() { return providerEmailVerified; }
    public OffsetDateTime getLinkedAt() { return linkedAt; }
}

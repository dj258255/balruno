// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * The persisted user. Visibility is package-private (this lives under
 * {@code internal}) — only the user module touches the JPA layer; the rest
 * of the codebase consumes user data via {@link com.balruno.user.UserAuthService}.
 *
 * ID generation lives on the database side: the PG column DEFAULT is
 * {@code uuidv7()} (RFC 9562 v7). Hibernate's {@code @UuidGenerator(
 * style=TIME)} would emit RFC 4122 v1 instead despite the name, so the
 * mapping omits the column on INSERT ({@code insertable=false}) and reads
 * the generated value back via the RETURNING clause ({@code @Generated}).
 */
@Entity
@Table(name = "users")
class UserEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "email", nullable = false, length = 254)
    private String email;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "name", length = 120)
    private String name;

    @Column(name = "avatar_url", length = 2048)
    private String avatarUrl;

    @Column(name = "locale", nullable = false, length = 10)
    private String locale = "ko";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    protected UserEntity() {
        // JPA requires a no-arg constructor.
    }

    UserEntity(String email, boolean emailVerified, String name, String avatarUrl) {
        this.email = email;
        this.emailVerified = emailVerified;
        this.name = name;
        this.avatarUrl = avatarUrl;
    }

    @PrePersist
    void onCreate() {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public boolean isEmailVerified() { return emailVerified; }
    public String getName() { return name; }
    public String getAvatarUrl() { return avatarUrl; }
    public String getLocale() { return locale; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public OffsetDateTime getLastLoginAt() { return lastLoginAt; }

    void markEmailVerified() { this.emailVerified = true; }
    void updateProfile(String name, String avatarUrl) {
        this.name = name;
        this.avatarUrl = avatarUrl;
    }
    void recordLogin() {
        this.lastLoginAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
}

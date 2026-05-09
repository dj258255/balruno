// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share.internal;

import com.balruno.share.ShareLink;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for the share_links table (V15). Internal to the
 * share module; the wider codebase consumes the
 * {@link com.balruno.share.ShareLink} record DTO via
 * {@link com.balruno.share.ShareService}.
 *
 * Same uuidv7-on-DB-side pattern as {@code UserEntity}: id + token
 * + created_at columns are insertable=false so PG generates them,
 * read back via the RETURNING clause that {@code @Generated} wires.
 */
@Entity
@Table(name = "share_links")
class ShareLinkEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "sheet_id", updatable = false)
    private UUID sheetId;

    @Column(name = "active_view", updatable = false)
    private String activeView;

    @Generated(event = EventType.INSERT)
    @Column(name = "token", nullable = false, updatable = false, insertable = false)
    private UUID token;

    @Column(name = "expires_at", updatable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "last_used_at")
    private OffsetDateTime lastUsedAt;

    protected ShareLinkEntity() {} // JPA

    ShareLinkEntity(UUID projectId, UUID sheetId, String activeView,
                    OffsetDateTime expiresAt, UUID createdBy) {
        this.projectId = projectId;
        this.sheetId = sheetId;
        this.activeView = activeView;
        this.expiresAt = expiresAt;
        this.createdBy = createdBy;
    }

    /** Project DTO — the public read model exposed via ShareService. */
    ShareLink toDto() {
        return new ShareLink(
                id, projectId, sheetId, activeView, token,
                expiresAt, revokedAt, createdBy, createdAt, lastUsedAt);
    }

    UUID getId() { return id; }
}

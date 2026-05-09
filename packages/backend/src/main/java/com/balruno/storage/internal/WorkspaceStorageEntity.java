// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * One row per workspace tracking cumulative attachment bytes. The
 * row is created with {@code total_bytes=0} during V28 backfill or
 * by an external trigger when a new workspace is provisioned; this
 * entity only handles updates against the existing row.
 *
 * The counter is atomic via the repository's native {@code UPDATE
 * SET total_bytes = total_bytes + ?} — Hibernate dirty-checking on
 * the entity field would race against concurrent uploads.
 *
 * Visibility is package-private — public surface is
 * {@link com.balruno.storage.WorkspaceStorageService}.
 */
@Entity
@Table(name = "workspace_storage")
class WorkspaceStorageEntity {

    @Id
    @Column(name = "workspace_id", nullable = false, updatable = false)
    private UUID workspaceId;

    @Column(name = "total_bytes", nullable = false)
    private long totalBytes;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected WorkspaceStorageEntity() {} // JPA

    @PreUpdate
    void onUpdate() {
        // Hibernate dirty-checking only runs the @PreUpdate callback
        // when an entity-level update fires; the atomic counter UPDATE
        // we use bypasses this. Kept for future entity-level mutations.
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    UUID getWorkspaceId() {
        return workspaceId;
    }

    long getTotalBytes() {
        return totalBytes;
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row claims that {@code (refKind, refId)} references the
 * attachment at {@code attachmentPath}. Multiple rows can target
 * the same path — the orphan-cleanup hook keys on COUNT == 0.
 *
 * Same uuidv7 default-on-DB-side trick {@code UserEntity} uses —
 * the column is {@code insertable=false} and Hibernate reads back
 * the generated value via the RETURNING clause.
 */
@Entity
@Table(name = "attachment_references")
class AttachmentReferenceEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "attachment_path", nullable = false)
    private String attachmentPath;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "ref_kind", nullable = false)
    private String refKind;

    @Column(name = "ref_id", nullable = false)
    private UUID refId;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    @Generated(event = EventType.INSERT)
    private OffsetDateTime createdAt;

    protected AttachmentReferenceEntity() {} // JPA

    AttachmentReferenceEntity(String attachmentPath,
                              UUID workspaceId,
                              String refKind,
                              UUID refId,
                              long sizeBytes) {
        this.attachmentPath = attachmentPath;
        this.workspaceId = workspaceId;
        this.refKind = refKind;
        this.refId = refId;
        this.sizeBytes = sizeBytes;
    }

    String getAttachmentPath() { return attachmentPath; }

    long getSizeBytes() { return sizeBytes; }
}

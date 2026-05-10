// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for the documents table (V7).
 *
 * Hocuspocus (Node sidecar) is the primary writer of {@code ydoc_state}
 * via its onLoadDocument / onStoreDocument hooks — Spring does not
 * read or update that column on the live edit path. The Spring side
 * only owns:
 *
 *   - The paired INSERT in {@link TreeOpService} on
 *     {@code tree.add(DOC, type=doc)} (cross-region with doc_tree).
 *   - The cascade soft-delete on {@code tree.delete} (mirrored in
 *     {@link DocumentRepository#cascadeSoftDelete}).
 *
 * The {@code ydoc_state} field is marked {@code FetchType.LAZY} as a
 * defensive hint — none of the Spring writes here read it back, but
 * the BYTEA can grow unbounded with a busy edit session and we never
 * want a stray repo query to pull it.
 *
 * id is supplied by the caller (matches the doc_tree leaf UUID, see
 * V7 schema comment) so {@code @Generated} is not used.
 */
@Entity
@Table(name = "documents")
class DocumentEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "slug", nullable = false, updatable = false, length = 50)
    private String slug;

    @Column(name = "title", nullable = false)
    private String title;

    @Basic(fetch = FetchType.LAZY)
    @Column(name = "ydoc_state", nullable = false, updatable = false)
    private byte[] ydocState;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    protected DocumentEntity() {} // JPA

    DocumentEntity(UUID id, UUID projectId, String slug, String title, byte[] ydocState) {
        this.id = id;
        this.projectId = projectId;
        this.slug = slug;
        this.title = title;
        this.ydocState = ydocState;
    }
}

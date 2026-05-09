// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.DocSnapshot;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Basic;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for doc_snapshots (V27 / ADR 0038 stage C).
 *
 * The yjs_state BYTEA can run into hundreds of KB per row, so the
 * page-history list never reads it — JPQL constructor projections
 * in {@link DocSnapshotRepository#listForDoc} pull only metadata,
 * and the bytes are fetched on demand via
 * {@link DocSnapshotRepository#findStateBytes}.
 *
 * The full entity is rarely loaded; declared here mostly so the
 * repository can sit on JpaRepository&lt;DocSnapshotEntity, UUID&gt;.
 */
@Entity
@Table(name = "doc_snapshots")
class DocSnapshotEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "doc_id", nullable = false, updatable = false)
    private UUID docId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    /** Lazy hint for safety, but the field is intentionally avoided
     *  in queries — the listForDoc path uses a constructor projection
     *  and the state-bytes path uses native SELECT. Lazy needs
     *  bytecode enhancement to actually defer; treat as belt-and-
     *  suspenders. */
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "yjs_state", nullable = false, updatable = false)
    private byte[] yjsState;

    @Column(name = "summary", updatable = false)
    private String summary;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected DocSnapshotEntity() {} // JPA

    DocSnapshot toMetadataDto() {
        return new DocSnapshot(id, docId, projectId, actorId, summary, createdAt);
    }
}

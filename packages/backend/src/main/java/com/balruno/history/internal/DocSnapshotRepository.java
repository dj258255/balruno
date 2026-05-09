// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.DocSnapshot;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence for doc_snapshots (V27).
 *
 * The list path returns a {@link DocSnapshot} DTO via JPQL
 * constructor projection — the yjs_state BYTEA isn't selected, so
 * a 100-row history page that would otherwise pull tens of MB stays
 * cheap. The state-bytes path is a separate native SELECT.
 *
 * findProjectIdForDoc reads from the documents table to resolve
 * the project for retention / auth. The discord/audit modules don't
 * mount documents as a JPA entity here, so a one-line native @Query
 * is the lightest option that still avoids JdbcTemplate.
 */
interface DocSnapshotRepository extends JpaRepository<DocSnapshotEntity, UUID> {

    @Query("""
           SELECT new com.balruno.history.DocSnapshot(
                   s.id, s.docId, s.projectId, s.actorId, s.summary, s.createdAt)
             FROM DocSnapshotEntity s
            WHERE s.docId = :docId
              AND s.createdAt >= :cutoff
            ORDER BY s.createdAt DESC
           """)
    List<DocSnapshot> listForDoc(@Param("docId") UUID docId,
                                 @Param("cutoff") OffsetDateTime cutoff,
                                 Limit limit);

    @Query("""
           SELECT new com.balruno.history.DocSnapshot(
                   s.id, s.docId, s.projectId, s.actorId, s.summary, s.createdAt)
             FROM DocSnapshotEntity s
            WHERE s.id = :snapshotId
           """)
    Optional<DocSnapshot> findMetadataById(@Param("snapshotId") UUID snapshotId);

    @Query(value = "SELECT yjs_state FROM doc_snapshots WHERE id = :id",
           nativeQuery = true)
    Optional<byte[]> findStateBytes(@Param("id") UUID id);

    @Query(value = "SELECT project_id FROM documents "
                 + "WHERE id = :docId AND deleted_at IS NULL",
           nativeQuery = true)
    Optional<UUID> findProjectIdForDoc(@Param("docId") UUID docId);

    @Modifying
    @Query(value = "DELETE FROM doc_snapshots "
                 + " WHERE created_at < now() - make_interval(days => :days)",
           nativeQuery = true)
    int pruneOlderThan(@Param("days") int days);
}

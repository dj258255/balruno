// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Persistence for the documents table inside the sync module's
 * cross-region tree-op flow. The Hocuspocus sidecar still owns the
 * yjs_state hot path; this repo only exposes the writes Spring needs:
 *
 *   - INSERT on doc tree.add (paired with the doc_tree leaf, ADR 0008
 *     v2.1 mirror) — handled via {@link JpaRepository#save}.
 *   - cascade soft-delete on doc tree.delete (paired with the deleted
 *     subtree id set) — native @Modifying because IN (:ids) over a
 *     dynamic set is the cleanest shape.
 *   - active fetch for the duplicate path — pulls the source doc's
 *     ydoc_state inside a single transaction so the new row's bytes
 *     match the last-stored snapshot.
 */
interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {

    @Modifying
    @Query(value = "UPDATE documents "
                 + "   SET deleted_at = now() "
                 + " WHERE id IN (:ids) "
                 + "   AND deleted_at IS NULL",
           nativeQuery = true)
    int cascadeSoftDelete(@Param("ids") Set<UUID> ids);

    /**
     * Active row by id — used by DocDuplicateService to read the
     * source doc's title + ydoc_state for cloning. JpaRepository's
     * stock findById ignores the soft-delete column.
     */
    @Query("SELECT d FROM DocumentEntity d "
         + " WHERE d.id = :id AND d.deletedAt IS NULL")
    Optional<DocumentEntity> findActiveById(@Param("id") UUID id);

    /**
     * Mint a UUIDv7 from PG's {@code uuidv7()} function (PG 18 native,
     * ADR 0012 v1.1 UUID policy: PK = UUIDv7 for time-sortable history
     * paging / snapshot lookup). Used when {@link DocumentEntity}'s id
     * has to be known on the Java side <em>before</em> INSERT because
     * the same UUID is mirrored into the doc_tree JSONB leaf — i.e. we
     * can't rely on the table's DEFAULT-on-INSERT path (ADR 0008 v2.1
     * doc tree.add cross-region mirror).
     *
     * One round-trip per minted id. Doc-clone / doc-tree-add are rare
     * paths so this cost is negligible vs. the correctness win of
     * keeping every Document PK on UUIDv7 instead of UUID.randomUUID()
     * (v4, time-disordered).
     */
    @Query(value = "SELECT uuidv7()", nativeQuery = true)
    UUID nextV7Id();
}

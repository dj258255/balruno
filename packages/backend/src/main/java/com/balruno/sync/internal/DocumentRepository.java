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
}

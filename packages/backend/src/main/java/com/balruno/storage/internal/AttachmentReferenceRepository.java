// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

/**
 * Persistence layer for the {@code attachment_references} table
 * (Tier 2b orphan cleanup).
 *
 * The orphan-detection contract lives in the service layer —
 * this repo only does (a) idempotent insert, (b) snapshot-by-content,
 * (c) delete-by-content, (d) count-by-path. The shape is deliberately
 * primitive so the SQL is auditable in one glance.
 */
interface AttachmentReferenceRepository extends JpaRepository<AttachmentReferenceEntity, UUID> {

    /**
     * Idempotent insert — same (path, kind, id) triple produces zero
     * new rows. Re-uploading the same hashed image into the same
     * target dedupes naturally because the path is content-addressed.
     * Returns affected row count (0 when the conflict path fired).
     */
    @Modifying
    @Query(value = "INSERT INTO attachment_references "
                 + "    (attachment_path, workspace_id, ref_kind, ref_id, size_bytes) "
                 + "SELECT :path, :workspaceId, :refKind, :refId, :size "
                 + " WHERE NOT EXISTS ("
                 + "     SELECT 1 FROM attachment_references "
                 + "      WHERE attachment_path = :path "
                 + "        AND ref_kind = :refKind "
                 + "        AND ref_id = :refId)",
           nativeQuery = true)
    int registerIfAbsent(@Param("path") String path,
                         @Param("workspaceId") UUID workspaceId,
                         @Param("refKind") String refKind,
                         @Param("refId") UUID refId,
                         @Param("size") long sizeBytes);

    /**
     * Snapshot the (path, size_bytes) tuples a piece of content
     * holds. Used as the input to the orphan calculation — the
     * service deletes the rows then COUNTs each path.
     */
    @Query(value = "SELECT attachment_path AS path, size_bytes AS sizeBytes "
                 + "  FROM attachment_references "
                 + " WHERE ref_kind = :refKind AND ref_id = :refId",
           nativeQuery = true)
    List<RefSnapshot> snapshot(@Param("refKind") String refKind,
                               @Param("refId") UUID refId);

    @Modifying
    @Query(value = "DELETE FROM attachment_references "
                 + " WHERE ref_kind = :refKind AND ref_id = :refId",
           nativeQuery = true)
    int deleteByContent(@Param("refKind") String refKind,
                        @Param("refId") UUID refId);

    @Query(value = "SELECT COUNT(*) FROM attachment_references "
                 + " WHERE attachment_path = :path",
           nativeQuery = true)
    long countByPath(@Param("path") String path);

    /**
     * Spring Data interface projection — JPA fills these from the
     * native query columns by alias. Lets the snapshot stay a thin
     * tuple without a dedicated record class on the entity surface.
     */
    interface RefSnapshot {
        String getPath();
        long getSizeBytes();
    }
}

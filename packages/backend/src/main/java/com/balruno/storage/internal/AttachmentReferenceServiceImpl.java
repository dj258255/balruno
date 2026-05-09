// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.AttachmentReferenceService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * JDBC backing for {@link AttachmentReferenceService}. Two SQLs only —
 * insert at upload time, delete at content-removal time with a
 * post-delete tally to discover newly orphaned paths.
 *
 * The orphan detection is two-step:
 *   1) Snapshot which (path, size) tuples this content held.
 *   2) Delete the rows.
 *   3) For each snapshot path, COUNT rows still referencing it.
 *      Zero matches → the path is now orphaned, return it.
 *
 * Doing the delete + count inside one transaction keeps a concurrent
 * upload from racing past zero — the count sees the freshly-deleted
 * state.
 */
@Service
class AttachmentReferenceServiceImpl implements AttachmentReferenceService {

    private final JdbcTemplate jdbc;

    AttachmentReferenceServiceImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public void register(UUID workspaceId,
                         String attachmentPath,
                         RefKind kind,
                         UUID refId,
                         long sizeBytes) {
        // Idempotent on the (path, kind, refId) shape — re-uploading
        // the same image inside the same target produces the same
        // hash-based path and we don't want to record a duplicate
        // ref. Postgres lacks a partial-unique constraint here so
        // we INSERT ... WHERE NOT EXISTS guard.
        jdbc.update(
                """
                INSERT INTO attachment_references
                    (attachment_path, workspace_id, ref_kind, ref_id, size_bytes)
                SELECT ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM attachment_references
                    WHERE attachment_path = ?
                      AND ref_kind = ?
                      AND ref_id = ?
                )
                """,
                attachmentPath, workspaceId, kind.name(), refId, sizeBytes,
                attachmentPath, kind.name(), refId);
    }

    @Override
    @Transactional
    public List<OrphanedAttachment> removeContentRefs(RefKind kind, UUID refId) {
        var snapshot = jdbc.queryForList(
                """
                SELECT attachment_path, size_bytes
                FROM attachment_references
                WHERE ref_kind = ? AND ref_id = ?
                """,
                kind.name(), refId);
        if (snapshot.isEmpty()) return List.of();

        jdbc.update(
                "DELETE FROM attachment_references WHERE ref_kind = ? AND ref_id = ?",
                kind.name(), refId);

        var orphans = new ArrayList<OrphanedAttachment>();
        for (var row : snapshot) {
            var path = (String) row.get("attachment_path");
            var size = ((Number) row.get("size_bytes")).longValue();
            var stillReferenced = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM attachment_references WHERE attachment_path = ?",
                    Long.class, path);
            if (stillReferenced != null && stillReferenced == 0) {
                orphans.add(new OrphanedAttachment(path, size));
            }
        }
        return orphans;
    }
}

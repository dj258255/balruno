// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.TestcontainersConfig;
import com.balruno.storage.AttachmentReferenceService;
import com.balruno.storage.AttachmentReferenceService.RefKind;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the attachment_references table (Tier 2b).
 * Verifies the orphan-cleanup contract:
 *   - register is idempotent on re-uploads
 *   - removeContentRefs returns the just-orphaned paths
 *   - shared paths (multi-content reference) stay alive when only
 *     one ref drops
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@Import(TestcontainersConfig.class)
class AttachmentReferenceServiceIntegrationTest {

    @Autowired AttachmentReferenceService refs;
    @Autowired JdbcTemplate jdbc;

    @Test
    @Transactional
    void registerThenRemoveReportsOrphan() {
        var workspaceId = seedWorkspace();
        var path = "attachments/" + UUID.randomUUID() + "/abc.png";
        var commentId = UUID.randomUUID();

        refs.register(workspaceId, path, RefKind.comment, commentId, 1024);

        var orphans = refs.removeContentRefs(RefKind.comment, commentId);

        assertThat(orphans)
                .singleElement()
                .satisfies(o -> {
                    assertThat(o.path()).isEqualTo(path);
                    assertThat(o.sizeBytes()).isEqualTo(1024);
                });
    }

    @Test
    @Transactional
    void removeContentRefsForUnknownIdReturnsEmpty() {
        // Idempotent: removing a non-existent comment's refs is a
        // legal no-op (handles re-deliveries from peer broadcasts).
        var orphans = refs.removeContentRefs(RefKind.comment, UUID.randomUUID());
        assertThat(orphans).isEmpty();
    }

    @Test
    @Transactional
    void registerIsIdempotentOnSameTuple() {
        var workspaceId = seedWorkspace();
        var path = "attachments/p/dedupe.png";
        var refId = UUID.randomUUID();

        // Re-uploading the same image into the same target dedupes
        // by hash — the ref shouldn't be inserted twice.
        refs.register(workspaceId, path, RefKind.comment, refId, 1024);
        refs.register(workspaceId, path, RefKind.comment, refId, 1024);
        refs.register(workspaceId, path, RefKind.comment, refId, 1024);

        var rowCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM attachment_references "
              + "WHERE attachment_path = ? AND ref_id = ?",
                Long.class, path, refId);
        assertThat(rowCount).isEqualTo(1L);
    }

    @Test
    @Transactional
    void sharedAttachmentStaysWhenOneOfTwoRefsDrops() {
        // Same file referenced by two different comments — removing
        // one ref must NOT report the path as orphaned (the other ref
        // is still alive).
        var workspaceId = seedWorkspace();
        var path = "attachments/p/shared.png";
        var commentA = UUID.randomUUID();
        var commentB = UUID.randomUUID();

        refs.register(workspaceId, path, RefKind.comment, commentA, 2048);
        refs.register(workspaceId, path, RefKind.comment, commentB, 2048);

        var orphansFromA = refs.removeContentRefs(RefKind.comment, commentA);
        assertThat(orphansFromA).isEmpty();

        // Removing the second one finally surfaces the orphan.
        var orphansFromB = refs.removeContentRefs(RefKind.comment, commentB);
        assertThat(orphansFromB)
                .singleElement()
                .satisfies(o -> assertThat(o.path()).isEqualTo(path));
    }

    @Test
    @Transactional
    void removingDocRefsLeavesCommentRefsAlone() {
        // A path can be referenced from multiple kinds at once
        // (e.g. an image embedded in both a doc body and a comment).
        // Removing the doc kind must not affect the comment kind.
        var workspaceId = seedWorkspace();
        var path = "attachments/p/multi-kind.png";
        var docId = UUID.randomUUID();
        var commentId = UUID.randomUUID();

        refs.register(workspaceId, path, RefKind.doc, docId, 4096);
        refs.register(workspaceId, path, RefKind.comment, commentId, 4096);

        var orphans = refs.removeContentRefs(RefKind.doc, docId);
        assertThat(orphans).isEmpty();

        var stillReferenced = jdbc.queryForObject(
                "SELECT COUNT(*) FROM attachment_references WHERE attachment_path = ?",
                Long.class, path);
        assertThat(stillReferenced).isEqualTo(1L);
    }

    private UUID seedWorkspace() {
        var userId = seedUser();
        var id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspaces (id, slug, name, plan, created_by) "
              + "VALUES (?, ?, ?, 'FREE'::workspace_plan, ?)",
                id, "ws-" + id.toString().substring(0, 8), "test", userId);
        return id;
    }

    private UUID seedUser() {
        var id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, email_verified) VALUES (?, ?, true)",
                id, "u-" + id + "@test");
        return id;
    }
}

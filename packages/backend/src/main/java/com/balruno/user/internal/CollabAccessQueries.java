// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Document access check used by collab token issuance.
 *
 * Lives in {@code com.balruno.user.internal} (next to the controller
 * that consumes it) so the new dependency does not introduce a
 * directory ↔ user slice cycle. directory already imports
 * {@code com.balruno.user.UserBrief}; a directory → user → directory
 * loop would break ApplicationModules.verify (spring-modulith).
 *
 * Native SQL via {@link JdbcClient} keeps this entity-free — the user
 * module reads the {@code documents → projects → workspaces ←
 * workspace_members} chain by SQL string only, no JPA @ManyToOne wiring
 * crossing module boundaries. Schema changes in the project / workspace
 * modules will surface here as a runtime SQL failure rather than a
 * compile error, which is the trade-off for keeping the slice graph
 * acyclic.
 *
 * Access semantics: a user can mint a collab token for a document
 * iff the document is not soft-deleted AND the user is a member of
 * the workspace owning the document's parent project. Roles are not
 * differentiated — any workspace member reads/writes the doc body.
 * Per-doc fine-grained perms are an ADR 0015 follow-up.
 */
@Service
class CollabAccessQueries {

    private final JdbcClient jdbc;

    CollabAccessQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * True iff {@code userId} is a member of the workspace owning the
     * project that contains {@code documentId}, and the document has
     * not been soft-deleted.
     *
     * Returns false for unknown documents — callers cannot tell
     * "doc never existed" apart from "doc exists but you are not a
     * member" (intentional IDOR defence; the controller maps both to
     * 404).
     */
    boolean canUserAccessDocument(UUID userId, UUID documentId) {
        return jdbc.sql("""
                SELECT EXISTS (
                  SELECT 1
                  FROM documents d
                  JOIN projects p ON p.id = d.project_id
                  JOIN workspace_members m ON m.workspace_id = p.workspace_id
                  WHERE d.id = :documentId
                    AND d.deleted_at IS NULL
                    AND m.user_id = :userId
                )
                """)
                .param("documentId", documentId)
                .param("userId", userId)
                .query(Boolean.class)
                .single();
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

/**
 * Document access check used by the collab token issuer.
 *
 * Lives in {@code user.internal} next to {@link CollabTokenController}
 * so the new dependency does not introduce a directory ↔ user slice
 * cycle. The full {@code @Entity DocumentEntity} sits in
 * {@code sync.internal} (V7 mapping owned by the sync module).
 *
 * Access semantics: a user can mint a collab token for a document iff
 * the document is not soft-deleted AND the user is a member of the
 * workspace owning the document's parent project. Roles are not
 * differentiated — any workspace member reads / writes the doc body.
 * Per-doc fine-grained perms are an ADR 0015 follow-up.
 *
 * Returns false for unknown documents — callers cannot tell "doc
 * never existed" apart from "doc exists but you are not a member"
 * (intentional IDOR defence; the controller maps both to 404).
 */
public interface CollabAccessRepository
        extends Repository<CollabAccessRepository.DocumentRef, UUID> {

    @Query(value = """
                   SELECT EXISTS (
                     SELECT 1
                       FROM documents d
                       JOIN projects p ON p.id = d.project_id
                       JOIN workspace_members m ON m.workspace_id = p.workspace_id
                      WHERE d.id = :documentId
                        AND d.deleted_at IS NULL
                        AND m.user_id = :userId
                   )
                   """,
           nativeQuery = true)
    boolean canUserAccessDocument(@Param("userId") UUID userId,
                                  @Param("documentId") UUID documentId);

    /**
     * Type-binding stub — Spring Data needs a managed entity for the
     * repository's domain type parameter. We never load this; all
     * methods are native @Query that return primitives or projections.
     */
    @Entity
    @Table(name = "documents")
    class DocumentRef {
        @Id
        @Column(name = "id", nullable = false, updatable = false, insertable = false)
        private UUID id;

        protected DocumentRef() {}
    }
}

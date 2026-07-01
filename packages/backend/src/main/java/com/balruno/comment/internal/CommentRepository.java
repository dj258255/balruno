// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence for comments + mentions (V11 / V12 / ADR 0024).
 *
 * Reads use derived methods so the partial index
 * (comments_sheet_cell_idx) is picked up directly. The two write
 * paths (updateBody / setResolved /
 * softDelete) stay native @Modifying so they get a single-row
 * UPDATE without dirty-checking and we can keep updated_at = now()
 * + the resolved-pair invariants in one statement.
 *
 * The mentions inbox query joins through the mentions table — JPQL
 * doesn't have a clean "exists in subquery" syntax against an
 * unmanaged join, so it uses a JPQL EXISTS clause referencing the
 * MentionEntity.
 */
interface CommentRepository extends JpaRepository<CommentEntity, UUID> {

    Optional<CommentEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<CommentEntity> findByProjectIdAndScopeKindAndSheetIdAndRowIdAndColumnIdAndDeletedAtIsNullOrderByCreatedAtAsc(
            UUID projectId, com.balruno.comment.Comment.ScopeKind scopeKind,
            UUID sheetId, UUID rowId, UUID columnId);

    List<CommentEntity> findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID projectId, Limit limit);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
           UPDATE CommentEntity c
              SET c.bodyJson = :body
            WHERE c.id = :id AND c.deletedAt IS NULL
           """)
    int updateBody(@Param("id") UUID id, @Param("body") JsonNode body);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
                   UPDATE comments
                      SET resolved    = true,
                          resolved_by = :resolver,
                          resolved_at = now(),
                          updated_at  = now()
                    WHERE id = :id AND deleted_at IS NULL
                   """,
           nativeQuery = true)
    int setResolved(@Param("id") UUID id, @Param("resolver") UUID resolver);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
                   UPDATE comments
                      SET resolved    = false,
                          resolved_by = NULL,
                          resolved_at = NULL,
                          updated_at  = now()
                    WHERE id = :id AND deleted_at IS NULL
                   """,
           nativeQuery = true)
    int setUnresolved(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE comments SET deleted_at = now() "
                 + " WHERE id = :id AND deleted_at IS NULL",
           nativeQuery = true)
    int softDelete(@Param("id") UUID id);

    /**
     * Inbox unread mentions — comments referenced by an unread
     * mention row for the user. JPQL EXISTS keeps the lookup off
     * native SQL while still hitting mentions_unread_idx.
     */
    @Query("""
           SELECT c FROM CommentEntity c
            WHERE c.deletedAt IS NULL
              AND EXISTS (
                  SELECT 1 FROM MentionEntity m
                   WHERE m.id.commentId = c.id
                     AND m.id.mentionedUser = :userId
                     AND m.notified = false)
            ORDER BY c.createdAt DESC
           """)
    List<CommentEntity> listUnreadMentions(@Param("userId") UUID userId, Limit limit);

    @Query("""
           SELECT c FROM CommentEntity c
            WHERE c.deletedAt IS NULL
              AND c.createdAt >= :since
              AND EXISTS (
                  SELECT 1 FROM MentionEntity m
                   WHERE m.id.commentId = c.id
                     AND m.id.mentionedUser = :userId)
            ORDER BY c.createdAt DESC
           """)
    List<CommentEntity> listMentionsSinceForUser(@Param("userId") UUID userId,
                                                  @Param("since") java.time.OffsetDateTime since,
                                                  Limit limit);

    /**
     * Walk back from a (possibly soft-deleted) comment id to its owning
     * workspace via the projects join. Tier 2b orphan-cleanup needs this
     * after softDelete so the storage counter decrement targets the
     * right workspace_storage row.
     */
    @Query(value = """
                   SELECT p.workspace_id
                     FROM comments c
                     JOIN projects p ON p.id = c.project_id
                    WHERE c.id = :commentId
                   """,
           nativeQuery = true)
    Optional<UUID> findWorkspaceIdOf(@Param("commentId") UUID commentId);
}

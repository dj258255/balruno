// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

/**
 * Public surface of the comment module — workspace + project
 * modules call into this. Internal {@code CommentServiceImpl} +
 * controller stay package-private (Spring Modulith verify keeps
 * cross-module access through this interface only).
 *
 * Authorisation: every method takes {@code callerUserId}. The
 * impl delegates to ProjectService.findById to enforce workspace
 * membership; non-members get ProjectException(PROJECT_NOT_FOUND).
 *
 * Soft delete: removeComment sets deleted_at. List endpoints
 * filter on deleted_at IS NULL.
 */
public interface CommentService {

    /** Create a thread root or a reply. parentId = null → root. */
    Comment create(UUID callerUserId, CreateRequest req);

    /** Edit body of a comment the caller authored. */
    Comment updateBody(UUID callerUserId, UUID commentId, JsonNode bodyJson);

    /** Mark resolved / unresolved. Author + Admin/Owner can flip. */
    Comment setResolved(UUID callerUserId, UUID commentId, boolean resolved);

    /** Soft delete. Author can delete; cascades to replies. */
    void remove(UUID callerUserId, UUID commentId);

    /** List comments at a sheet cell (newest first). Includes replies. */
    List<Comment> listForCell(
            UUID callerUserId,
            UUID projectId,
            UUID sheetId,
            UUID rowId,
            UUID columnId);

    /**
     * Project-wide comment browse used by the dock CommentsPanel —
     * every non-deleted comment in the project, newest first, capped
     * at 200. Replies are included; the panel groups them client-side.
     * Auth: caller must be a member of the project.
     */
    List<Comment> listForProject(UUID callerUserId, UUID projectId);

    /** Inbox — unread mentions for a user across all projects. */
    List<Comment> listUnreadMentions(UUID userId, int limit);

    /** Digest backing query — comments that mention {@code userId}
     *  and were created on or after {@code since}. Used by the
     *  daily / weekly digest scheduler (ADR 0024 Stage I). Newest
     *  first; capped at 200 to keep the email body bounded. */
    List<Comment> listMentionsSinceForUser(UUID userId, java.time.OffsetDateTime since);

    record CreateRequest(
            UUID projectId,
            Comment.ScopeKind scopeKind,
            UUID sheetId,
            UUID rowId,
            UUID columnId,
            UUID parentId,
            JsonNode bodyJson
    ) {}
}

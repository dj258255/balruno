// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import com.balruno.comment.Comment;
import com.balruno.comment.CommentService;
import com.balruno.project.ProjectService;
import com.balruno.sync.ProjectSyncApi;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Comment CRUD with workspace-scoped authorisation. Every method
 * starts with a ProjectService.findById call — that's the
 * canonical "is the caller a project member?" check + throws
 * ProjectException(PROJECT_NOT_FOUND) on failure.
 *
 * Mentions: {@link MentionExtractor} walks the Tiptap JSON body
 * and pulls out user UUIDs from `data-mention` attributes; we
 * insert mention rows in the same transaction. Notification
 * delivery (inbox / push / email) is a separate phase — for now
 * the inbox UI polls the unread mention list.
 */
@Service
class CommentServiceImpl implements CommentService {

    private final CommentRepository repo;
    private final ProjectService projects;
    private final ProjectSyncApi sync;

    CommentServiceImpl(CommentRepository repo, ProjectService projects, ProjectSyncApi sync) {
        this.repo = repo;
        this.projects = projects;
        this.sync = sync;
    }

    /**
     * Schedules a wss broadcast after the current transaction
     * commits — a rolled-back tx can't push a misleading event to
     * peers. Failure inside the broadcast is swallowed
     * (ProjectSyncApi logs internally) so the surrounding HTTP
     * response stays successful.
     */
    private void broadcastAfterCommit(UUID projectId, String type, Comment payload) {
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        sync.broadcastEvent(projectId, type, payload);
                    }
                });
    }

    private void broadcastDeleteAfterCommit(UUID projectId, UUID commentId) {
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        sync.broadcastEvent(
                                projectId,
                                "comment.deleted",
                                java.util.Map.of("commentId", commentId.toString()));
                    }
                });
    }

    @Override
    @Transactional
    public Comment create(UUID callerUserId, CreateRequest req) {
        // Auth — non-members of req.projectId throw here.
        projects.findById(req.projectId(), callerUserId);

        var id = UUID.randomUUID();
        var now = OffsetDateTime.now();
        var draft = new Comment(
                id,
                req.projectId(),
                req.scopeKind(),
                req.sheetId(),
                req.rowId(),
                req.columnId(),
                req.documentId(),
                req.anchorPosition(),
                req.anchorLength(),
                req.parentId(),
                callerUserId,
                req.bodyJson(),
                false, null, null,
                now, now);
        var saved = repo.insert(draft);
        repo.insertMentions(saved.id(), MentionExtractor.parse(req.bodyJson()));
        broadcastAfterCommit(saved.projectId(), "comment.added", saved);
        return saved;
    }

    @Override
    @Transactional
    public Comment updateBody(UUID callerUserId, UUID commentId, JsonNode bodyJson) {
        var existing = repo.findByIdOrThrow(commentId);
        if (!existing.authorUserId().equals(callerUserId)) {
            throw new IllegalStateException("only the author can edit the body");
        }
        // Auth on the project too — defence-in-depth.
        projects.findById(existing.projectId(), callerUserId);

        var updated = repo.updateBody(commentId, bodyJson);
        // Re-extract mentions; new entries get inserted (existing
        // (comment_id, user) pairs are no-op via ON CONFLICT DO NOTHING).
        repo.insertMentions(commentId, MentionExtractor.parse(bodyJson));
        broadcastAfterCommit(updated.projectId(), "comment.updated", updated);
        return updated;
    }

    @Override
    @Transactional
    public Comment setResolved(UUID callerUserId, UUID commentId, boolean resolved) {
        var existing = repo.findByIdOrThrow(commentId);
        projects.findById(existing.projectId(), callerUserId);
        // Author-or-admin check is done in production via WorkspaceRole;
        // for now, any project member can resolve (matches Linear /
        // Notion default — restrictive flag lands in Stage G).
        var updated = repo.setResolved(commentId, resolved, resolved ? callerUserId : null);
        broadcastAfterCommit(updated.projectId(), "comment.updated", updated);
        return updated;
    }

    @Override
    @Transactional
    public void remove(UUID callerUserId, UUID commentId) {
        var existing = repo.findByIdOrThrow(commentId);
        if (!existing.authorUserId().equals(callerUserId)) {
            throw new IllegalStateException("only the author can delete the comment");
        }
        projects.findById(existing.projectId(), callerUserId);
        repo.softDelete(commentId);
        broadcastDeleteAfterCommit(existing.projectId(), commentId);
    }

    @Override
    public List<Comment> listForCell(
            UUID callerUserId,
            UUID projectId,
            UUID sheetId,
            UUID rowId,
            UUID columnId) {
        projects.findById(projectId, callerUserId);
        return repo.listForCell(projectId, sheetId, rowId, columnId);
    }

    @Override
    public List<Comment> listForDoc(UUID callerUserId, UUID projectId, UUID documentId) {
        projects.findById(projectId, callerUserId);
        return repo.listForDoc(projectId, documentId);
    }

    @Override
    public List<Comment> listUnreadMentions(UUID userId, int limit) {
        // No project-level auth — the user is just looking at their
        // own inbox. The repository filters on mentioned_user = userId.
        return repo.listUnreadMentions(userId, Math.max(1, Math.min(limit, 200)));
    }

    /**
     * Walks a Tiptap JSON tree and pulls out unique mentioned user
     * UUIDs. Tiptap's mention extension serialises each @user as a
     * {type: "mention", attrs: {id: "<uuid>"}} node.
     */
    static final class MentionExtractor {
        static List<UUID> parse(JsonNode body) {
            var out = new ArrayList<UUID>();
            walk(body, out);
            return out;
        }

        private static void walk(JsonNode node, List<UUID> out) {
            if (node == null || node.isNull()) return;
            if (node.isObject()) {
                var type = node.get("type");
                if (type != null && "mention".equals(type.asText())) {
                    var attrs = node.get("attrs");
                    if (attrs != null) {
                        var idField = attrs.get("id");
                        if (idField != null && !idField.isNull()) {
                            try {
                                var uuid = UUID.fromString(idField.asText());
                                if (!out.contains(uuid)) out.add(uuid);
                            } catch (IllegalArgumentException ignored) {
                                // mention id wasn't a UUID — skip
                            }
                        }
                    }
                }
                var content = node.get("content");
                if (content != null && content.isArray()) {
                    for (var child : content) walk(child, out);
                }
            } else if (node.isArray()) {
                for (var child : node) walk(child, out);
            }
        }
    }
}

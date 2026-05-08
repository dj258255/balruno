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
    private final org.springframework.context.ApplicationEventPublisher events;

    /** databind autowired (tools.jackson) — kept private fasterxml
     *  mapper for tree work in the webhook payload (project_sb4). */
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapperForHook =
            new com.fasterxml.jackson.databind.ObjectMapper();

    CommentServiceImpl(CommentRepository repo, ProjectService projects, ProjectSyncApi sync,
                       org.springframework.context.ApplicationEventPublisher events) {
        this.repo = repo;
        this.projects = projects;
        this.sync = sync;
        this.events = events;
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
        var mentions = MentionExtractor.parse(req.bodyJson());
        repo.insertMentions(saved.id(), mentions);
        broadcastAfterCommit(saved.projectId(), "comment.added", saved);
        // Outbound webhook fanout — fires after the same afterCommit
        // gate so a rolled-back create can't notify external receivers.
        // Comment + each mention get separate events; receivers can
        // subscribe independently via the events[] column. ADR 0028.
        webhookHook(saved.projectId(), "comment.added", saved);
        // Notification fanout — email + Web Push to mentioned users
        // (ADR 0024 Stage I). The notification module listens via
        // @EventListener so the comment module never imports it.
        var bodyText = MentionExtractor.flatten(req.bodyJson());
        for (var mentionedUser : mentions) {
            webhookHook(saved.projectId(), "mention.created",
                    java.util.Map.of(
                            "commentId", saved.id().toString(),
                            "mentionedUser", mentionedUser.toString()));
            mentionEventAfterCommit(saved.projectId(), mentionedUser, saved.id(),
                    callerUserId, bodyText);
        }
        return saved;
    }

    private void mentionEventAfterCommit(
            UUID projectId, UUID mentionedUser, UUID commentId,
            UUID authorUserId, String bodyText) {
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            events.publishEvent(
                                    new com.balruno.events.MentionCreatedEvent(
                                            projectId, mentionedUser, commentId,
                                            authorUserId, bodyText));
                        } catch (Exception ignored) {
                            // Notification failures must never bubble.
                        }
                    }
                });
    }

    private void webhookHook(UUID projectId, String event, Object payload) {
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            // Publish via ApplicationEvent so the
                            // webhook module isn't a static dep here.
                            // Spring Modulith's arch test rejects the
                            // direct call. ADR 0028.
                            events.publishEvent(new com.balruno.events.WebhookEvent(
                                    projectId, event,
                                    nodeMapperForHook.valueToTree(payload)));
                        } catch (Exception e) {
                            // Webhook failures must never bubble out of
                            // commit hooks — log + carry on.
                        }
                    }
                });
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

        /** Flatten a Tiptap doc to plain text for the notification
         *  email body / push body preview. Uses string concatenation;
         *  the 200-char truncation lives at the call site. */
        static String flatten(JsonNode body) {
            var sb = new StringBuilder();
            walkText(body, sb);
            return sb.toString().trim();
        }

        private static void walkText(JsonNode node, StringBuilder out) {
            if (node == null || node.isNull()) return;
            if (node.isObject()) {
                var type = node.get("type");
                if (type != null && "text".equals(type.asText())) {
                    var text = node.get("text");
                    if (text != null && !text.isNull()) {
                        out.append(text.asText()).append(' ');
                    }
                }
                var content = node.get("content");
                if (content != null && content.isArray()) {
                    for (var child : content) walkText(child, out);
                }
            } else if (node.isArray()) {
                for (var child : node) walkText(child, out);
            }
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

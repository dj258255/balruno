// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import com.balruno.comment.Comment;
import com.balruno.comment.CommentService;
import com.balruno.project.ProjectService;
import com.balruno.sync.ProjectSyncService;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private static final Logger log = LoggerFactory.getLogger(CommentServiceImpl.class);

    private final CommentRepository repo;
    private final MentionRepository mentions;
    private final ProjectService projects;
    private final ProjectSyncService sync;
    private final com.balruno.events.AfterCommitPublisher afterCommit;
    private final com.balruno.storage.AttachmentReferenceService attachmentRefs;
    private final com.balruno.storage.StorageService storage;
    private final com.balruno.storage.WorkspaceStorageService workspaceStorage;

    /** databind autowired (tools.jackson) — kept private fasterxml
     *  mapper for tree work in the webhook payload (project_sb4).
     *  JSR310 module registered so OffsetDateTime fields on Comment /
     *  payload records serialise (test discovered the gap; the prod
     *  paths happened not to hit timestamped payloads yet). */
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapperForHook =
            new com.fasterxml.jackson.databind.ObjectMapper()
                    .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    CommentServiceImpl(CommentRepository repo, MentionRepository mentions,
                       ProjectService projects, ProjectSyncService sync,
                       com.balruno.events.AfterCommitPublisher afterCommit,
                       com.balruno.storage.AttachmentReferenceService attachmentRefs,
                       com.balruno.storage.StorageService storage,
                       com.balruno.storage.WorkspaceStorageService workspaceStorage) {
        this.repo = repo;
        this.mentions = mentions;
        this.projects = projects;
        this.sync = sync;
        this.afterCommit = afterCommit;
        this.attachmentRefs = attachmentRefs;
        this.storage = storage;
        this.workspaceStorage = workspaceStorage;
    }

    /**
     * Schedules a wss broadcast after the current transaction
     * commits — a rolled-back tx can't push a misleading event to
     * peers. Failure inside the broadcast is logged
     * (AfterCommitPublisher policy) so the surrounding HTTP
     * response stays successful.
     */
    private void broadcastAfterCommit(UUID projectId, String type, Comment payload) {
        afterCommit.runAfterCommit(() -> sync.broadcastEvent(projectId, type, payload));
    }

    private void broadcastDeleteAfterCommit(UUID projectId, UUID commentId) {
        afterCommit.runAfterCommit(() -> sync.broadcastEvent(
                projectId,
                "comment.deleted",
                java.util.Map.of("commentId", commentId.toString())));
    }

    @Override
    @Transactional
    public Comment create(UUID callerUserId, CreateRequest req) {
        // Auth — non-members of req.projectId throw here.
        projects.findById(req.projectId(), callerUserId);

        var entity = new CommentEntity(
                req.projectId(),
                req.scopeKind(),
                req.sheetId(),
                req.rowId(),
                req.columnId(),
                req.parentId(),
                callerUserId,
                req.bodyJson());
        var saved = repo.save(entity).toDto();
        var mentioned = MentionExtractor.parse(req.bodyJson());
        insertMentionRows(saved.id(), mentioned);
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
        for (var mentionedUser : mentioned) {
            webhookHook(saved.projectId(), "mention.created",
                    java.util.Map.of(
                            "commentId", saved.id().toString(),
                            "mentionedUser", mentionedUser.toString()));
            mentionEventAfterCommit(saved.projectId(), mentionedUser, saved.id(),
                    callerUserId, bodyText);
        }
        return saved;
    }

    private void insertMentionRows(UUID commentId, List<UUID> mentionedUsers) {
        for (var userId : mentionedUsers) {
            mentions.insertIgnore(commentId, userId);
        }
    }

    private void mentionEventAfterCommit(
            UUID projectId, UUID mentionedUser, UUID commentId,
            UUID authorUserId, String bodyText) {
        afterCommit.publish(new com.balruno.events.MentionCreatedEvent(
                projectId, mentionedUser, commentId, authorUserId, bodyText));
    }

    private void webhookHook(UUID projectId, String event, Object payload) {
        // Publish via ApplicationEvent so the webhook module isn't a
        // static dep here. Spring Modulith's arch test rejects the
        // direct call. ADR 0028.
        afterCommit.publish(new com.balruno.events.WebhookEvent(
                projectId, event,
                nodeMapperForHook.valueToTree(payload)));
    }

    @Override
    @Transactional
    public Comment updateBody(UUID callerUserId, UUID commentId, JsonNode bodyJson) {
        var existing = findByIdOrThrow(commentId);
        if (!existing.authorUserId().equals(callerUserId)) {
            throw new IllegalStateException("only the author can edit the body");
        }
        // Auth on the project too — defence-in-depth.
        projects.findById(existing.projectId(), callerUserId);

        repo.updateBody(commentId, bodyJson);
        // Re-extract mentions; new entries get inserted (existing
        // (comment_id, user) pairs are no-op via ON CONFLICT DO NOTHING).
        insertMentionRows(commentId, MentionExtractor.parse(bodyJson));
        var updated = findByIdOrThrow(commentId);
        broadcastAfterCommit(updated.projectId(), "comment.updated", updated);
        return updated;
    }

    @Override
    @Transactional
    public Comment setResolved(UUID callerUserId, UUID commentId, boolean resolved) {
        var existing = findByIdOrThrow(commentId);
        projects.findById(existing.projectId(), callerUserId);
        // Author-or-admin check is done in production via WorkspaceRole;
        // for now, any project member can resolve (matches Linear /
        // Notion default — restrictive flag lands in Stage G).
        if (resolved) {
            repo.setResolved(commentId, callerUserId);
        } else {
            repo.setUnresolved(commentId);
        }
        var updated = findByIdOrThrow(commentId);
        broadcastAfterCommit(updated.projectId(), "comment.updated", updated);
        return updated;
    }

    @Override
    @Transactional
    public void remove(UUID callerUserId, UUID commentId) {
        var existing = findByIdOrThrow(commentId);
        if (!existing.authorUserId().equals(callerUserId)) {
            throw new IllegalStateException("only the author can delete the comment");
        }
        projects.findById(existing.projectId(), callerUserId);
        repo.softDelete(commentId);
        broadcastDeleteAfterCommit(existing.projectId(), commentId);

        // Tier 2b orphan cleanup — release every attachment ref this
        // comment held; orphaned paths get their R2 blobs deleted +
        // workspace counter decremented. Runs afterCommit so a
        // rolled-back delete can't free still-referenced bytes.
        attachmentCleanupAfterCommit(commentId);
    }

    private Comment findByIdOrThrow(UUID id) {
        return repo.findByIdAndDeletedAtIsNull(id)
                .map(CommentEntity::toDto)
                .orElseThrow(() -> new IllegalStateException("comment not found: " + id));
    }

    private void attachmentCleanupAfterCommit(UUID commentId) {
        afterCommit.runAfterCommit(() -> {
            var orphans = attachmentRefs.removeContentRefs(
                    com.balruno.storage.AttachmentReferenceService.RefKind.comment,
                    commentId);
            for (var orphan : orphans) {
                try {
                    storage.delete(orphan.path());
                } catch (Exception e) {
                    // best-effort — R2 lifecycle / cron will sweep.
                    // log at DEBUG so an operator can flip the level
                    // when chasing a stuck blob without spamming prod.
                    log.debug("comment attachment delete failed path={}", orphan.path(), e);
                }
            }
            // Aggregate the now-orphaned bytes and decrement the
            // workspace counter once so a chatty comment with
            // many attachments doesn't issue N small UPDATEs.
            long total = 0L;
            for (var orphan : orphans) total += orphan.sizeBytes();
            if (total > 0) {
                // Comment may have spanned multiple workspaces in
                // theory, but project membership pins the comment
                // to one project + one workspace. Pull the workspace
                // off the comment we just removed.
                workspaceStorage.decrement(
                        commentWorkspaceId(commentId), total);
            }
        });
    }

    /**
     * Walk back from a soft-deleted comment id to its workspace.
     * Persistence sits in {@link CommentRepository#findWorkspaceIdOf}.
     */
    private UUID commentWorkspaceId(UUID commentId) {
        return repo.findWorkspaceIdOf(commentId)
                .orElseThrow(() -> new IllegalStateException(
                        "comment workspace lookup failed: " + commentId));
    }

    @Override
    public List<Comment> listForCell(
            UUID callerUserId,
            UUID projectId,
            UUID sheetId,
            UUID rowId,
            UUID columnId) {
        projects.findById(projectId, callerUserId);
        return repo.findByProjectIdAndScopeKindAndSheetIdAndRowIdAndColumnIdAndDeletedAtIsNullOrderByCreatedAtAsc(
                        projectId, Comment.ScopeKind.SHEET_CELL, sheetId, rowId, columnId)
                .stream().map(CommentEntity::toDto).toList();
    }

    @Override
    public List<Comment> listForProject(UUID callerUserId, UUID projectId) {
        projects.findById(projectId, callerUserId);
        return repo.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(projectId, Limit.of(200))
                .stream().map(CommentEntity::toDto).toList();
    }

    @Override
    public List<Comment> listUnreadMentions(UUID userId, int limit) {
        // No project-level auth — the user is just looking at their
        // own inbox. The repository filters on mentioned_user = userId.
        return repo.listUnreadMentions(userId, Limit.of(Math.max(1, Math.min(limit, 200))))
                .stream().map(CommentEntity::toDto).toList();
    }

    @Override
    public List<Comment> listMentionsSinceForUser(UUID userId, java.time.OffsetDateTime since) {
        return repo.listMentionsSinceForUser(userId, since, Limit.of(200))
                .stream().map(CommentEntity::toDto).toList();
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

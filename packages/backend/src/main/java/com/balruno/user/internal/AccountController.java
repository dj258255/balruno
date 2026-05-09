// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Self-service GDPR endpoints (right to be forgotten + data
 * portability).
 *
 *   GET    /v1/me/export-data         — JSON dump of everything keyed
 *                                       to the caller's user_id
 *   DELETE /v1/me/account?confirm=... — soft-delete the user. The
 *                                       owner-of-only-workspace case
 *                                       returns 409 with a guard.
 *
 * Soft-delete semantics: rows in workspaces / projects / comments
 * stay (other members still own them) but the user row gets
 * {@code deleted_at} so OAuth login is rejected and the email is
 * stripped from member listings. Cascade hard-delete is *avoided*
 * for the same reason GitHub keeps "ghost" attribution — orphaning
 * other users' work is worse than one nullified row.
 */
@RestController
@Tag(name = "Account")
@SecurityRequirement(name = "bearerAuth")
class AccountController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();
    private final com.balruno.storage.StorageService storage;
    private final org.springframework.context.ApplicationEventPublisher events;

    AccountController(JdbcTemplate jdbc,
                      com.balruno.storage.StorageService storage,
                      org.springframework.context.ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.events = events;
    }

    @GetMapping(path = "/me/export-data", version = "1")
    ObjectNode exportMyData(@AuthenticationPrincipal Jwt jwt) {
        var userId = UUID.fromString(jwt.getSubject());
        var root = json.createObjectNode();
        root.put("schemaVersion", 1);
        root.put("exportedAt", java.time.OffsetDateTime.now().toString());
        root.put("userId", userId.toString());

        // user row (sanitised — no internal flags)
        var userRows = jdbc.queryForList(
                "SELECT id, email, name, avatar_url, locale, created_at "
              + "FROM users WHERE id = ? AND deleted_at IS NULL",
                userId);
        root.set("user", json.valueToTree(userRows.isEmpty() ? null : userRows.get(0)));

        // memberships
        ArrayNode memberships = root.putArray("memberships");
        for (var m : jdbc.queryForList(
                "SELECT workspace_id, role, created_at FROM workspace_members WHERE user_id = ?",
                userId)) {
            memberships.add(json.valueToTree(m));
        }

        // workspaces the user owns or is admin of
        ArrayNode workspaces = root.putArray("workspaces");
        for (var w : jdbc.queryForList(
                "SELECT w.id, w.slug, w.name, w.created_at "
              + "FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id "
              + "WHERE m.user_id = ? AND w.deleted_at IS NULL",
                userId)) {
            workspaces.add(json.valueToTree(w));
        }

        // projects in those workspaces
        ArrayNode projects = root.putArray("projects");
        for (var p : jdbc.queryForList(
                """
                SELECT p.id, p.workspace_id, p.slug, p.name, p.description,
                       p.data, p.sheet_tree, p.doc_tree,
                       p.data_version, p.sheet_tree_version, p.doc_tree_version,
                       p.created_at, p.updated_at
                FROM projects p
                JOIN workspace_members m ON m.workspace_id = p.workspace_id
                WHERE m.user_id = ? AND p.deleted_at IS NULL
                """,
                userId)) {
            projects.add(json.valueToTree(p));
        }

        // comments authored by the user
        ArrayNode comments = root.putArray("comments");
        for (var c : jdbc.queryForList(
                "SELECT id, project_id, scope_kind, body_json, created_at, updated_at "
              + "FROM comments WHERE author_user_id = ? AND deleted_at IS NULL",
                userId)) {
            comments.add(json.valueToTree(c));
        }

        // notification preferences + push subscriptions
        var prefs = jdbc.queryForList(
                "SELECT * FROM user_notification_preferences WHERE user_id = ?",
                userId);
        root.set("notificationPreferences", json.valueToTree(prefs.isEmpty() ? null : prefs.get(0)));

        ArrayNode pushSubs = root.putArray("webPushSubscriptions");
        for (var s : jdbc.queryForList(
                "SELECT id, endpoint, user_agent, created_at, last_used_at "
              + "FROM web_push_subscriptions WHERE user_id = ?",
                userId)) {
            pushSubs.add(json.valueToTree(s));
        }

        return root;
    }

    @DeleteMapping(path = "/me/account", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    ResponseEntity<?> deleteAccount(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("confirm") String confirm) {
        var userId = UUID.fromString(jwt.getSubject());

        // Confirm-by-typing — the frontend asks the user to type
        // "DELETE" (or their email). 'I understand' confirmations
        // get clicked through; typing forces deliberate intent.
        if (!"DELETE".equals(confirm)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("error", "type DELETE in confirm to proceed"));
        }

        // Owner-of-only-workspace guard: if the user is the sole
        // owner of any workspace + that workspace has other members,
        // reject. They must transfer ownership or remove members
        // first. Solo owners with no other members can proceed —
        // workspace gets soft-deleted in the same tx.
        var blockers = jdbc.queryForList(
                """
                SELECT w.id, w.slug
                FROM workspaces w
                WHERE w.deleted_at IS NULL
                  AND EXISTS (
                      SELECT 1 FROM workspace_members
                      WHERE workspace_id = w.id AND user_id = ? AND role = 'OWNER')
                  AND (
                      SELECT COUNT(*) FROM workspace_members
                      WHERE workspace_id = w.id AND role = 'OWNER'
                            AND user_id <> ?) = 0
                  AND (
                      SELECT COUNT(*) FROM workspace_members
                      WHERE workspace_id = w.id AND user_id <> ?) > 0
                """,
                userId, userId, userId);
        if (!blockers.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(java.util.Map.of(
                            "error", "transfer ownership of these workspaces first",
                            "workspaces", blockers));
        }

        // Soft-delete cascade: user row + sole-owner workspaces +
        // those workspaces' projects.
        jdbc.update("UPDATE users SET deleted_at = now(), email = NULL WHERE id = ?", userId);
        jdbc.update(
                """
                UPDATE workspaces SET deleted_at = now()
                WHERE deleted_at IS NULL
                  AND id IN (
                      SELECT workspace_id FROM workspace_members
                      WHERE user_id = ? AND role = 'OWNER')
                """,
                userId);
        // Snapshot the projects we're about to soft-delete so we can
        // emit storage cascade events for each (R2 attachments cleanup
        // happens in AttachmentCascadeListener).
        var projectsToCascade = jdbc.queryForList(
                """
                SELECT id, workspace_id FROM projects
                WHERE deleted_at IS NULL
                  AND workspace_id IN (
                      SELECT id FROM workspaces WHERE deleted_at IS NOT NULL)
                """);
        jdbc.update(
                """
                UPDATE projects SET deleted_at = now()
                WHERE deleted_at IS NULL
                  AND workspace_id IN (
                      SELECT id FROM workspaces WHERE deleted_at IS NOT NULL)
                """);

        // GDPR cascade — afterCommit so a rolled-back DELETE doesn't
        // wipe the R2 blobs. Avatar prefix is user-scoped; project
        // attachments are cascaded via the same event the project
        // module emits (sharing the AttachmentCascadeListener).
        var capturedUserId = userId;
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            storage.deleteByPrefix("avatars/" + capturedUserId + "/");
                        } catch (Exception e) {
                            // Best-effort; orphan avatar blobs are benign
                            // and a future R2 lifecycle rule sweeps them.
                        }
                        for (var row : projectsToCascade) {
                            var pid = (java.util.UUID) row.get("id");
                            var wid = (java.util.UUID) row.get("workspace_id");
                            events.publishEvent(
                                    new com.balruno.events.ProjectSoftDeletedEvent(pid, wid));
                        }
                    }
                });

        return ResponseEntity.noContent().build();
    }
}

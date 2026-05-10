// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.security.Principals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
 * GDPR endpoints — Article 20 export + Article 17 delete.
 *
 * The actual SQL lives in {@link UserAccountRepository}; this class
 * is the route + auth layer only. Kept thin so the GDPR-critical
 * confirm-by-typing flow + ownership-blocker rules sit in plain
 * sight, not buried under JDBC plumbing.
 */
@RestController
@Tag(name = "Account")
@SecurityRequirement(name = "bearerAuth")
class AccountController {

    private final UserAccountRepository repo;
    private final ObjectMapper json = new ObjectMapper();
    private final com.balruno.events.AfterCommitPublisher afterCommit;

    AccountController(UserAccountRepository repo,
                      com.balruno.events.AfterCommitPublisher afterCommit) {
        this.repo = repo;
        this.afterCommit = afterCommit;
    }

    @GetMapping(path = "/me/export-data", version = "1")
    ObjectNode exportMyData(@AuthenticationPrincipal Jwt jwt) {
        var userId = Principals.userId(jwt);
        var root = json.createObjectNode();
        root.put("schemaVersion", 1);
        root.put("exportedAt", java.time.OffsetDateTime.now().toString());
        root.put("userId", userId.toString());

        root.set("user", json.valueToTree(repo.userRow(userId).orElse(null)));

        ArrayNode memberships = root.putArray("memberships");
        for (var m : repo.memberships(userId)) memberships.add(json.valueToTree(m));

        ArrayNode workspaces = root.putArray("workspaces");
        for (var w : repo.workspacesForUser(userId)) workspaces.add(json.valueToTree(w));

        ArrayNode projects = root.putArray("projects");
        for (var p : repo.projectsForUser(userId)) projects.add(json.valueToTree(p));

        ArrayNode comments = root.putArray("comments");
        for (var c : repo.commentsByAuthor(userId)) comments.add(json.valueToTree(c));

        root.set("notificationPreferences",
                json.valueToTree(repo.notificationPreferences(userId).orElse(null)));

        ArrayNode pushSubs = root.putArray("webPushSubscriptions");
        for (var s : repo.webPushSubscriptions(userId)) pushSubs.add(json.valueToTree(s));

        return root;
    }

    @DeleteMapping(path = "/me/account", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    ResponseEntity<?> deleteAccount(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("confirm") String confirm) {
        var userId = Principals.userId(jwt);

        // Confirm-by-typing — the frontend asks the user to type
        // "DELETE" (or their email). 'I understand' confirmations
        // get clicked through; typing forces deliberate intent.
        if (!"DELETE".equals(confirm)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("error", "type DELETE in confirm to proceed"));
        }

        // Owner-of-only-workspace guard: if the user is the sole owner
        // of any workspace + that workspace has other members, reject.
        // They must transfer ownership or remove members first. Solo
        // owners with no other members can proceed — workspace gets
        // soft-deleted in the same tx via the cascade below.
        var blockers = repo.ownershipBlockers(userId);
        if (!blockers.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(java.util.Map.of(
                            "error", "transfer ownership of these workspaces first",
                            "workspaces", blockers));
        }

        // Snapshot the projects we're about to soft-delete so we can
        // emit storage cascade events for each (R2 attachments cleanup
        // happens in AttachmentCascadeListener).
        var projectsToCascade = repo.projectsToCascade();
        repo.softDeleteUser(userId);
        repo.softDeleteOwnedWorkspaces(userId);
        repo.softDeleteProjectsOfDeletedWorkspaces();

        // GDPR cascade — afterCommit so a rolled-back DELETE doesn't
        // wipe the R2 blobs. Avatar prefix and project attachments are
        // both cascaded via events; the storage module listens. Direct
        // storage call would create a user → storage Modulith arch
        // cycle (storage already depends on project, project on user).
        afterCommit.publish(new com.balruno.events.AvatarReplacedEvent(
                "avatars/" + userId + "/"));
        for (var row : projectsToCascade) {
            afterCommit.publish(new com.balruno.events.ProjectSoftDeletedEvent(
                    row.getId(), row.getWorkspaceId()));
        }

        return ResponseEntity.noContent().build();
    }
}

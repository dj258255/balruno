// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import com.balruno.security.Principals;

import com.balruno.comment.Comment;
import com.balruno.comment.CommentService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST surface for the comment module (ADR 0024).
 *
 *   POST  /v1/comments                          — create
 *   PATCH /v1/comments/{id}                     — body / resolved toggle
 *   DELETE /v1/comments/{id}                    — soft delete
 *   GET   /v1/projects/{id}/comments            — list (cell scope)
 *   GET   /v1/me/inbox                          — unread mentions
 *
 * Auth: bearer JWT, member of the project. Service layer enforces
 * via ProjectService.findById; non-members get 404.
 */
@RestController
@Tag(name = "Comment")
@SecurityRequirement(name = "bearerAuth")
class CommentController {

    private final CommentService comments;

    CommentController(CommentService comments) {
        this.comments = comments;
    }

    @PostMapping(path = "/comments", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Comment create(@AuthenticationPrincipal Jwt jwt, @RequestBody @Valid CreateRequest body) {
        return comments.create(callerId(jwt), new CommentService.CreateRequest(
                body.projectId(),
                body.scopeKind(),
                body.sheetId(),
                body.rowId(),
                body.columnId(),
                body.parentId(),
                body.bodyJson()));
    }

    @PatchMapping(path = "/comments/{id}", version = "1")
    Comment update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestBody @Valid UpdateRequest body) {
        if (body.bodyJson() != null) {
            return comments.updateBody(callerId(jwt), id, body.bodyJson());
        }
        if (body.resolved() != null) {
            return comments.setResolved(callerId(jwt), id, body.resolved());
        }
        throw new IllegalArgumentException("body must include bodyJson or resolved");
    }

    @DeleteMapping(path = "/comments/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        comments.remove(callerId(jwt), id);
    }

    @GetMapping(path = "/projects/{projectId}/comments", version = "1")
    List<Comment> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestParam(required = false) Comment.ScopeKind scope,
            @RequestParam(required = false) UUID sheetId,
            @RequestParam(required = false) UUID rowId,
            @RequestParam(required = false) UUID columnId) {
        // scope omitted → project-wide browse (CommentsPanel dock).
        if (scope == null) {
            return comments.listForProject(callerId(jwt), projectId);
        }
        return switch (scope) {
            case SHEET_CELL -> {
                if (sheetId == null || rowId == null || columnId == null) {
                    throw new IllegalArgumentException(
                            "scope=SHEET_CELL requires sheetId + rowId + columnId");
                }
                yield comments.listForCell(callerId(jwt), projectId, sheetId, rowId, columnId);
            }
            case SHEET_ROW -> {
                if (sheetId == null || rowId == null) {
                    throw new IllegalArgumentException(
                            "scope=SHEET_ROW requires sheetId + rowId");
                }
                yield comments.listForRow(callerId(jwt), projectId, sheetId, rowId);
            }
        };
    }

    @GetMapping(path = "/me/inbox", version = "1")
    List<Comment> inbox(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "50") int limit) {
        return comments.listUnreadMentions(callerId(jwt), limit);
    }

    private static UUID callerId(Jwt jwt) {
        return Principals.userId(jwt);
    }

    record CreateRequest(
            @NotNull UUID projectId,
            @NotNull Comment.ScopeKind scopeKind,
            UUID sheetId,
            UUID rowId,
            UUID columnId,
            UUID parentId,
            @NotNull JsonNode bodyJson
    ) {}

    record UpdateRequest(JsonNode bodyJson, Boolean resolved) {}
}

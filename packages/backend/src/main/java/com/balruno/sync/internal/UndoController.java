// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.project.ProjectService;
import com.balruno.security.Principals;

import com.balruno.sync.UndoService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST surface for server-backed undo / redo (ADR 0021 v2.3 Phase 5).
 *
 *   POST /v1/projects/{id}/undo   — pop latest reversible action by user × tab
 *   POST /v1/projects/{id}/redo   — pop latest undone action and re-apply
 *
 * Per-tab scope comes from the {@code X-Client-Session-Id} header
 * (Baserow's {@code ClientUndoRedoActionGroupId} pattern, reduced to
 * the session id here — the action group id only matters at emit
 * time). Same header on every emit and on undo / redo so the row
 * lookup matches.
 *
 * Auth: bearer JWT + per-request project membership check. The
 * service layer already filters {@code op_idempotency} by the caller's
 * userId, but that alone lets an ex-member (still holding a valid
 * pre-revoke JWT) probe arbitrary projectIds and receive a well-formed
 * {@code NothingToUndo} response — effectively a low-noise IDOR
 * enumeration surface. The {@code projectService.findById(projectId,
 * callerId)} gate below converts those probes into the 404 / 403 path
 * that every other project-scoped controller emits.
 */
@RestController
@Tag(name = "Undo")
@SecurityRequirement(name = "bearerAuth")
class UndoController {

    private final UndoService undo;
    private final ProjectService projects;

    UndoController(UndoService undo, ProjectService projects) {
        this.undo = undo;
        this.projects = projects;
    }

    @PostMapping(path = "/projects/{projectId}/undo", version = "1")
    UndoService.UndoResult undo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestHeader(name = "X-Client-Session-Id") @NotNull UUID clientSessionId) {
        var callerId = callerId(jwt);
        projects.findById(projectId, callerId);   // throws if not member / not found
        return undo.undo(callerId, projectId, clientSessionId);
    }

    @PostMapping(path = "/projects/{projectId}/redo", version = "1")
    UndoService.UndoResult redo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestHeader(name = "X-Client-Session-Id") @NotNull UUID clientSessionId) {
        var callerId = callerId(jwt);
        projects.findById(projectId, callerId);
        return undo.redo(callerId, projectId, clientSessionId);
    }

    /**
     * Hydrate the client's local undo stack after a page refresh
     * (ADR 0021 v2.3 Phase 5.E). Returns the user's most recent
     * reversible actions in this tab, newest first. The client
     * decodes via the {@code undone} flag on each entry to populate
     * past + future stacks separately.
     */
    @GetMapping(path = "/projects/{projectId}/undo-stack", version = "1")
    List<UndoService.UndoStackEntry> stack(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestHeader(name = "X-Client-Session-Id") @NotNull UUID clientSessionId,
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        var callerId = callerId(jwt);
        projects.findById(projectId, callerId);
        return undo.recentReversible(callerId, projectId, clientSessionId, limit);
    }

    private static UUID callerId(Jwt jwt) {
        return Principals.userId(jwt);
    }
}

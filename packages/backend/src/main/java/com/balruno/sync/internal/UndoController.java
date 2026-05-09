// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

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
 * Auth: bearer JWT. Service-layer authorisation is delegated to the
 * row filter (only ops by the caller's userId are returned), so
 * non-members of the project naturally get NothingToUndo.
 */
@RestController
@Tag(name = "Undo")
@SecurityRequirement(name = "bearerAuth")
class UndoController {

    private final UndoService undo;

    UndoController(UndoService undo) {
        this.undo = undo;
    }

    @PostMapping(path = "/projects/{projectId}/undo", version = "1")
    UndoService.UndoResult undo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestHeader(name = "X-Client-Session-Id") @NotNull UUID clientSessionId) {
        return undo.undo(callerId(jwt), projectId, clientSessionId);
    }

    @PostMapping(path = "/projects/{projectId}/redo", version = "1")
    UndoService.UndoResult redo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestHeader(name = "X-Client-Session-Id") @NotNull UUID clientSessionId) {
        return undo.redo(callerId(jwt), projectId, clientSessionId);
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
        return undo.recentReversible(callerId(jwt), projectId, clientSessionId, limit);
    }

    private static UUID callerId(Jwt jwt) {
        return Principals.userId(jwt);
    }
}

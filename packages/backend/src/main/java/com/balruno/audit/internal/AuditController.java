// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit.internal;

import com.balruno.security.Principals;

import com.balruno.audit.AuditEntry;
import com.balruno.audit.AuditService;
import com.balruno.workspace.WorkspaceService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * GET /v1/workspaces/:id/audit-log
 *
 * Membership check via WorkspaceService.listForUser. Tier gating
 * (TEAM only per ADR 0016) lands when billing wires plan reads
 * into LimitGuard — for now any member can read.
 */
@RestController
@Tag(name = "AuditLog")
@SecurityRequirement(name = "bearerAuth")
class AuditController {

    private final AuditService audit;
    private final WorkspaceService workspaces;

    AuditController(AuditService audit, WorkspaceService workspaces) {
        this.audit = audit;
        this.workspaces = workspaces;
    }

    @GetMapping(path = "/workspaces/{workspaceId}/audit-log", version = "1")
    List<AuditEntry> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        var caller = Principals.userId(jwt);
        var memberships = workspaces.listForUser(caller);
        var match = memberships.stream().anyMatch(w -> w.id().equals(workspaceId));
        if (!match) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.NOT_FOUND, "workspace not found");
        }
        return audit.listForWorkspace(caller, workspaceId, limit);
    }
}

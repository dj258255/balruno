// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.quota.internal;

import com.balruno.project.ProjectService;
import com.balruno.quota.UserQuota;
import com.balruno.quota.WorkspaceQuotaUsage;
import com.balruno.workspace.WorkspaceLimits;
import com.balruno.workspace.WorkspaceService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * The {@code /api/v1/me/quota} endpoint (FR-LIMIT-003). Aggregates the
 * caller's user-level cap (owned workspaces) and a per-workspace usage
 * row for each owned workspace. Lives in its own module so depending on
 * both workspace + project does not create a slice cycle.
 */
@RestController
@Tag(name = "Quota")
@SecurityRequirement(name = "bearerAuth")
class QuotaController {

    private final WorkspaceService workspaces;
    private final ProjectService projects;

    QuotaController(WorkspaceService workspaces, ProjectService projects) {
        this.workspaces = workspaces;
        this.projects = projects;
    }

    @GetMapping(path = "/me/quota", version = "1")
    UserQuota quota(@AuthenticationPrincipal Jwt jwt) {
        var userId = UUID.fromString(jwt.getSubject());

        var owned = workspaces.listOwnedFor(userId);
        var perWorkspace = owned.stream()
                .map(ws -> new WorkspaceQuotaUsage(
                        ws.id(),
                        ws.slug(),
                        ws.name(),
                        ws.plan(),
                        workspaces.countMembers(ws.id()),
                        projects.countActiveInWorkspace(ws.id()),
                        WorkspaceLimits.forPlan(ws.plan())))
                .toList();

        return new UserQuota(userId, owned.size(), List.copyOf(perWorkspace));
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.CreatedInvite;
import com.balruno.workspace.Workspace;
import com.balruno.workspace.WorkspaceInvite;
import com.balruno.workspace.WorkspaceMember;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Workspace + member + invite REST surface. Authorisation lives in
 * {@link WorkspaceService} — controllers just translate the JWT subject
 * into the caller's UUID and pass it down. Invite acceptance lives at
 * the top-level {@code /api/v1/invites/{token}/accept} so newly-arriving
 * users (who may not yet be a member of any workspace) hit a path that
 * doesn't pre-resolve a workspace.
 */
@RestController
@Tag(name = "Workspace")
@SecurityRequirement(name = "bearerAuth")
class WorkspaceController {

    private final WorkspaceService workspaces;

    WorkspaceController(WorkspaceService workspaces) {
        this.workspaces = workspaces;
    }

    // ── workspaces ─────────────────────────────────────────────────────

    @GetMapping(path = "/workspaces", version = "1")
    List<Workspace> list(@AuthenticationPrincipal Jwt jwt) {
        return workspaces.listForUser(callerId(jwt));
    }

    @PostMapping(path = "/workspaces", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Workspace create(@AuthenticationPrincipal Jwt jwt, @RequestBody @Valid CreateRequest body) {
        return workspaces.create(callerId(jwt), body.slug(), body.name());
    }

    @GetMapping(path = "/workspaces/{id}", version = "1")
    Workspace get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        // Membership check — non-members shouldn't even see the workspace exists.
        workspaces.requireRole(id, callerId(jwt), WorkspaceRole.VIEWER);
        return workspaces.findById(id);
    }

    @PatchMapping(path = "/workspaces/{id}", version = "1")
    Workspace update(@AuthenticationPrincipal Jwt jwt,
                     @PathVariable UUID id,
                     @RequestBody @Valid UpdateRequest body) {
        return workspaces.update(id, callerId(jwt), body.slug(), body.name());
    }

    @DeleteMapping(path = "/workspaces/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        workspaces.softDelete(id, callerId(jwt));
    }

    // ── members ────────────────────────────────────────────────────────
    // The list endpoint lives in com.balruno.directory.internal.MemberController
    // — that module joins WorkspaceService.listMembers with UserDirectoryService
    // to inline user identity. Mutations stay here because they operate on the
    // workspace_members table directly.

    @PatchMapping(path = "/workspaces/{id}/members/{userId}", version = "1")
    WorkspaceMember changeRole(@AuthenticationPrincipal Jwt jwt,
                               @PathVariable UUID id,
                               @PathVariable UUID userId,
                               @RequestBody @Valid ChangeRoleRequest body) {
        return workspaces.changeMemberRole(id, callerId(jwt), userId, body.role());
    }

    @DeleteMapping(path = "/workspaces/{id}/members/{userId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeMember(@AuthenticationPrincipal Jwt jwt,
                      @PathVariable UUID id,
                      @PathVariable UUID userId) {
        workspaces.removeMember(id, callerId(jwt), userId);
    }

    // ── invites ────────────────────────────────────────────────────────

    @PostMapping(path = "/workspaces/{id}/invites", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    CreatedInvite createInvite(@AuthenticationPrincipal Jwt jwt,
                               @PathVariable UUID id,
                               @RequestBody(required = false) CreateInviteRequest body) {
        var role = body == null ? null : body.role();
        var ttl = body == null ? null : body.expiresIn();
        return workspaces.createInvite(id, callerId(jwt), role, ttl);
    }

    @GetMapping(path = "/workspaces/{id}/invites", version = "1")
    List<WorkspaceInvite> listInvites(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return workspaces.listInvites(id, callerId(jwt));
    }

    @DeleteMapping(path = "/workspaces/{id}/invites/{inviteId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revokeInvite(@AuthenticationPrincipal Jwt jwt,
                      @PathVariable UUID id,
                      @PathVariable UUID inviteId) {
        workspaces.revokeInvite(id, callerId(jwt), inviteId);
    }

    @PostMapping(path = "/invites/{token}/accept", version = "1")
    WorkspaceMember acceptInvite(@AuthenticationPrincipal Jwt jwt,
                                 @PathVariable String token) {
        return workspaces.acceptInvite(callerId(jwt), token);
    }

    // ── helpers ────────────────────────────────────────────────────────

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    // ── request bodies ─────────────────────────────────────────────────

    record CreateRequest(
            @NotBlank @Size(min = 3, max = 30) String slug,
            @NotBlank @Size(min = 1, max = 120) String name) {}

    record UpdateRequest(
            @Size(min = 3, max = 30) String slug,
            @Size(min = 1, max = 120) String name) {}

    record ChangeRoleRequest(@NotNull WorkspaceRole role) {}

    record CreateInviteRequest(WorkspaceRole role, Duration expiresIn) {}
}

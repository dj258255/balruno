// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.directory.internal;

import com.balruno.directory.WorkspaceMemberView;
import com.balruno.user.UserDirectoryService;
import com.balruno.workspace.WorkspaceMember;
import com.balruno.workspace.WorkspaceService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Aggregator endpoint that joins {@link WorkspaceService#listMembers} with
 * {@link UserDirectoryService#findBriefsByIds} so the member list arrives
 * with user identity inlined. Lives in its own module so depending on
 * both workspace + user does not put either into a slice cycle.
 */
@RestController
@Tag(name = "Directory")
@SecurityRequirement(name = "bearerAuth")
class MemberController {

    private final WorkspaceService workspaces;
    private final UserDirectoryService users;

    MemberController(WorkspaceService workspaces, UserDirectoryService users) {
        this.workspaces = workspaces;
        this.users = users;
    }

    @GetMapping(path = "/workspaces/{workspaceId}/members", version = "1")
    List<WorkspaceMemberView> list(@PathVariable UUID workspaceId,
                                   @AuthenticationPrincipal Jwt jwt) {
        var callerId = UUID.fromString(jwt.getSubject());
        var members = workspaces.listMembers(workspaceId, callerId);

        var ids = members.stream().map(WorkspaceMember::userId).toList();
        var briefs = users.findBriefsByIds(ids);

        return members.stream()
                .map(m -> new WorkspaceMemberView(
                        m.workspaceId(),
                        m.userId(),
                        briefs.get(m.userId()),     // null if dangling FK
                        m.role(),
                        m.joinedAt()))
                .toList();
    }
}

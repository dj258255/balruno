// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.directory;

import com.balruno.user.UserBrief;
import com.balruno.workspace.WorkspaceRole;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Workspace member with the user identity inlined for rendering. Replaces
 * the bare {@code WorkspaceMember} on list endpoints — mutation responses
 * still return the bare shape since the caller already knows who they
 * just changed.
 *
 * {@code user} is nullable: a foreign-key dangling row (deleted user)
 * surfaces as {@code null} so the UI can render "탈퇴한 사용자" rather
 * than 500-erroring.
 */
public record WorkspaceMemberView(
        UUID workspaceId,
        UUID userId,
        UserBrief user,
        WorkspaceRole role,
        OffsetDateTime joinedAt
) {}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Public read model for a workspace_members row. */
public record WorkspaceMember(
        UUID workspaceId,
        UUID userId,
        WorkspaceRole role,
        OffsetDateTime joinedAt
) {}

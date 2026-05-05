// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public read model for a workspace_invites row. The opaque secret
 * (raw token) is intentionally NOT a field — it is returned exactly
 * once at creation time via {@link CreatedInvite}.
 */
public record WorkspaceInvite(
        UUID id,
        UUID workspaceId,
        WorkspaceRole role,
        UUID invitedBy,
        OffsetDateTime expiresAt,
        OffsetDateTime acceptedAt,
        UUID acceptedBy,
        OffsetDateTime revokedAt
) {
    public boolean isActive(OffsetDateTime now) {
        return acceptedAt == null && revokedAt == null && expiresAt.isAfter(now);
    }
}

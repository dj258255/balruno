// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public DTO for a share link (ADR 0027). The token field is the
 * opaque handle the public viewer presents; everything else is
 * audit / management data shown in the project settings panel.
 */
public record ShareLink(
        UUID id,
        UUID projectId,
        UUID sheetId,
        String activeView,
        UUID token,
        OffsetDateTime expiresAt,
        OffsetDateTime revokedAt,
        UUID createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime lastUsedAt
) {
    public boolean isActive(OffsetDateTime now) {
        if (revokedAt != null) return false;
        if (expiresAt != null && expiresAt.isBefore(now)) return false;
        return true;
    }
}

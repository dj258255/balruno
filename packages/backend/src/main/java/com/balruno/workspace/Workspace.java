// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public read model returned by {@link WorkspaceService}. The JPA entity
 * stays inside the {@code internal} package so callers never touch
 * persistence types.
 */
public record Workspace(
        UUID id,
        String slug,
        String name,
        WorkspacePlan plan,
        UUID createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}

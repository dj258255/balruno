// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public read model for a project. The JPA entity stays in the
 * {@code internal} package; callers consume this DTO only.
 */
public record Project(
        UUID id,
        UUID workspaceId,
        String slug,
        String name,
        String description,
        UUID createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}

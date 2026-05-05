// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Workspace 의 공개 read model. WorkspaceService 가 반환하는 DTO — JPA
 * entity 는 internal 패키지에 격리.
 */
public record Workspace(
        UUID id,
        String slug,
        String name,
        UUID createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}

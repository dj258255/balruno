// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AuditEntry(
        UUID id,
        UUID workspaceId,
        UUID actorUserId,
        String action,
        String resourceType,
        UUID resourceId,
        JsonNode payload,
        OffsetDateTime createdAt
) {}

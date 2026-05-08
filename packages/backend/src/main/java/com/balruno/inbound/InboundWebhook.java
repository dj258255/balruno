// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InboundWebhook(
        UUID id,
        UUID projectId,
        String provider,
        UUID targetSheetId,
        UUID secret,
        JsonNode columnMapping,
        boolean active,
        OffsetDateTime lastReceivedAt,
        String lastStatus,
        String lastError,
        UUID createdBy,
        OffsetDateTime createdAt
) {}

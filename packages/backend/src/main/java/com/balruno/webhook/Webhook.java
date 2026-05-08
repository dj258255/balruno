// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Public DTO for an outbound webhook subscription (ADR 0028).
 *
 * The {@code secret} field is exposed only at creation — list /
 * read responses null it out so it can't leak from the audit log.
 */
public record Webhook(
        UUID id,
        UUID projectId,
        String url,
        List<String> events,
        UUID secret,
        boolean active,
        OffsetDateTime lastAttemptAt,
        Integer lastStatusCode,
        String lastError,
        UUID createdBy,
        OffsetDateTime createdAt
) {}

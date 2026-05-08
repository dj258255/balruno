// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Spring ApplicationEvent any module emits to log a workspace-level
 * activity (ADR 0032).
 *
 * Lives in the events leaf module so publishers (project, comment,
 * workspace, ...) and the consumer (audit) don't form a static dep
 * cycle. Same pattern as WebhookEvent / MentionCreatedEvent.
 *
 * Publishers should emit on TransactionSynchronization afterCommit
 * so a rolled-back DB transaction can't leave a misleading log row.
 */
public record AuditLogEvent(
        UUID workspaceId,
        UUID actorUserId,
        String action,
        String resourceType,
        UUID resourceId,
        JsonNode payload
) {}

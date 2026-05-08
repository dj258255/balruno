// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Spring ApplicationEvent published by other modules to trigger
 * outbound webhook delivery (ADR 0028).
 *
 * Lives in {@code shared.api} because both publishers (sync,
 * comment) and the consumer (webhook) need the type but neither
 * should depend on the other — Spring Modulith's ArchitectureTest
 * rejects the cycle. {@code shared} is the modulith-blessed neutral
 * carrier package.
 *
 * Publishers should always emit on TransactionSynchronization
 * afterCommit so a rolled-back DB transaction can't notify
 * external receivers.
 */
public record WebhookEvent(
        UUID projectId,
        String event,
        JsonNode payload
) {}

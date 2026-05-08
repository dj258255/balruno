// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import java.util.UUID;

/**
 * Fired when a comment containing an @mention is created
 * (ADR 0024 Stage I).
 *
 * Lives in the events leaf module so publishers (comment) and
 * consumers (notification, webhook) don't form a static module dep
 * cycle. Spring Modulith ArchitectureTest enforces.
 *
 * Publishers should always emit on TransactionSynchronization
 * afterCommit so a rolled-back DB transaction can't trigger a
 * notification.
 */
public record MentionCreatedEvent(
        UUID projectId,
        UUID mentionedUserId,
        UUID commentId,
        UUID authorUserId,
        String commentBodyPlainText
) {}

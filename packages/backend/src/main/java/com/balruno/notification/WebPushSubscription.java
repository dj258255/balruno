// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public DTO for a Web Push subscription (one row per user × browser
 * device). Carries the three values the Web Push protocol needs to
 * deliver: endpoint URL, ECDH public key, auth secret.
 */
public record WebPushSubscription(
        UUID id,
        UUID userId,
        String endpoint,
        String p256dh,
        String auth,
        String userAgent,
        OffsetDateTime createdAt,
        OffsetDateTime lastUsedAt
) {}

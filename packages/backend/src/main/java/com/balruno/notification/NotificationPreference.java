// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public DTO for user notification preferences (ADR 0024 Stage I).
 */
public record NotificationPreference(
        UUID userId,
        boolean emailOnMention,
        boolean emailOnCommentReply,
        boolean pushOnMention,
        boolean pushOnCommentReply,
        DigestFrequency digestFrequency,
        OffsetDateTime updatedAt
) {
    public enum DigestFrequency {
        INSTANT, DAILY, WEEKLY, OFF;

        public static DigestFrequency parse(String s) {
            if (s == null) return INSTANT;
            return switch (s.toLowerCase()) {
                case "instant" -> INSTANT;
                case "daily" -> DAILY;
                case "weekly" -> WEEKLY;
                case "off" -> OFF;
                default -> INSTANT;
            };
        }

        public String wireValue() {
            return name().toLowerCase();
        }
    }
}

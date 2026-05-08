// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public DTO for a Discord workspace link (ADR 0030).
 *
 * Bot token is *not* exposed — list / read responses null it out
 * for the same reason webhook secrets are nulled.
 */
public record DiscordLink(
        UUID id,
        UUID workspaceId,
        String discordGuildId,
        String discordApplicationId,
        String discordPublicKey,
        String discordBotToken,
        UUID defaultSheetId,
        boolean active,
        OffsetDateTime lastInteractionAt,
        String lastStatus,
        UUID createdBy,
        OffsetDateTime createdAt
) {
    public DiscordLink withTokenStripped() {
        return new DiscordLink(
                id, workspaceId, discordGuildId, discordApplicationId,
                discordPublicKey, null, defaultSheetId, active,
                lastInteractionAt, lastStatus, createdBy, createdAt);
    }
}

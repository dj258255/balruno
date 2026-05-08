// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

/** Public surface of the Discord integration module (ADR 0030). */
public interface DiscordService {

    DiscordLink create(UUID callerUserId, UUID workspaceId, CreateInput input);

    List<DiscordLink> listForWorkspace(UUID callerUserId, UUID workspaceId);

    DiscordLink findById(UUID linkId);

    void delete(UUID callerUserId, UUID linkId);

    /**
     * Process a verified Discord interaction (slash command). The
     * controller has already checked the Ed25519 signature and
     * extracted the guild id; this method routes by command name
     * and returns the JSON response Discord expects.
     */
    JsonNode handleInteraction(JsonNode interaction);

    record CreateInput(
            String discordGuildId,
            String discordApplicationId,
            String discordPublicKey,
            String discordBotToken,
            UUID defaultSheetId
    ) {}
}

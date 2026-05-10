// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord.internal;

import com.balruno.discord.DiscordLink;
import com.balruno.discord.DiscordService;
import com.balruno.events.InboundRowRequestedEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
class DiscordServiceImpl implements DiscordService {

    private final DiscordRepository repo;
    private final ApplicationEventPublisher events;
    private final ObjectMapper json = new ObjectMapper();

    DiscordServiceImpl(DiscordRepository repo, ApplicationEventPublisher events) {
        this.repo = repo;
        this.events = events;
    }

    @Override
    @Transactional
    public DiscordLink create(UUID callerUserId, UUID workspaceId, CreateInput input) {
        repo.upsert(workspaceId, input.discordGuildId(), input.discordApplicationId(),
                input.discordPublicKey(), input.discordBotToken(), input.defaultSheetId(),
                callerUserId);
        // The native UPSERT doesn't return the row, so we re-fetch by
        // the conflict key to hand back the hydrated DTO. One extra
        // SELECT, but the create path is rare enough that the trade
        // is worth keeping the @Query trivial.
        return repo.findByWorkspaceIdAndDiscordGuildId(workspaceId, input.discordGuildId())
                .orElseThrow(() -> new IllegalStateException("upsert succeeded but row missing"))
                .toDto();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DiscordLink> listForWorkspace(UUID callerUserId, UUID workspaceId) {
        return repo.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId).stream()
                .map(DiscordLinkEntity::toDto)
                .map(DiscordLink::withTokenStripped)
                .toList();
    }

    @Override
    public DiscordLink findById(UUID linkId) {
        return repo.findById(linkId).map(DiscordLinkEntity::toDto).orElse(null);
    }

    @Override
    @Transactional
    public void delete(UUID callerUserId, UUID linkId) {
        repo.deleteById(linkId);
    }

    @Override
    public JsonNode handleInteraction(JsonNode interaction) {
        // Type 1 = PING (Discord verification). Reply with type=1 (PONG).
        // Type 2 = APPLICATION_COMMAND (slash command).
        // Other types ignored.
        var type = interaction.path("type").asInt(0);
        if (type == 1) {
            ObjectNode pong = json.createObjectNode();
            pong.put("type", 1);
            return pong;
        }
        if (type != 2) {
            return ack("Unsupported interaction type: " + type);
        }

        var applicationId = interaction.path("application_id").asText("");
        var link = repo.findFirstByDiscordApplicationIdAndActiveTrue(applicationId)
                .map(DiscordLinkEntity::toDto)
                .orElse(null);
        if (link == null) {
            return ack("This Discord app is not linked to a Balruno workspace.");
        }

        var data = interaction.path("data");
        var commandName = data.path("name").asText("");

        return switch (commandName) {
            case "balruno" -> handleSubcommand(link, data);
            default -> ack("Unknown command: /" + commandName);
        };
    }

    private JsonNode handleSubcommand(DiscordLink link, JsonNode data) {
        var options = data.path("options");
        if (!options.isArray() || options.isEmpty()) {
            return ack("Use /balruno bug <text> or /balruno query <text>");
        }
        var subOption = options.get(0);
        var subName = subOption.path("name").asText("");
        var subValue = subOption.path("options").isArray() && subOption.path("options").size() > 0
                ? subOption.path("options").get(0).path("value").asText("") : "";

        return switch (subName) {
            case "bug" -> handleBug(link, subValue);
            case "query" -> handleQuery(link, subValue);
            default -> ack("Unknown subcommand: " + subName);
        };
    }

    private JsonNode handleBug(DiscordLink link, String text) {
        if (link.defaultSheetId() == null) {
            return ack("This workspace has no default sheet for bugs. Set one in Balruno settings.");
        }
        // Resolve the sheet → project lookup directly via JdbcTemplate.
        // The discord module stays off the project module's static dep
        // graph this way (we only read a single column).
        var projectId = projectIdForSheet(link.defaultSheetId());
        if (projectId == null) {
            return ack("Default sheet not found in any project.");
        }

        ObjectNode cells = json.createObjectNode();
        cells.put("__discord_text", text);
        ObjectNode row = json.createObjectNode();
        var rowId = UUID.randomUUID();
        row.put("id", rowId.toString());
        row.set("cells", cells);

        events.publishEvent(new InboundRowRequestedEvent(
                projectId, link.defaultSheetId(), link.createdBy(),
                rowId, row));

        repo.recordInteraction(link.id(), OffsetDateTime.now(), "bug:" + rowId);
        return ack("Bug logged: " + text);
    }

    /**
     * Cross-aggregate lookup delegated to the repository — see
     * {@link DiscordRepository#findProjectIdForSheet}. Slow if called
     * in a hot loop, but Discord interactions are low-frequency
     * (under 1 / sec for solo + small teams) and the data column is
     * small.
     */
    private UUID projectIdForSheet(UUID sheetId) {
        return repo.findProjectIdForSheet(sheetId.toString()).orElse(null);
    }

    private JsonNode handleQuery(DiscordLink link, String text) {
        // V1 only acknowledges — actual cell lookup needs project_id +
        // sheet read access, which runs through events leaf in a follow-up.
        repo.recordInteraction(link.id(), OffsetDateTime.now(), "query");
        return ack("Query received (read-only lookup ships in v2): " + text);
    }

    /** Discord interaction response type=4 = CHANNEL_MESSAGE_WITH_SOURCE. */
    private JsonNode ack(String message) {
        ObjectNode resp = json.createObjectNode();
        resp.put("type", 4);
        ObjectNode data = json.createObjectNode();
        data.put("content", message);
        // Make the response ephemeral (only visible to the user who ran
        // the command). 64 = MessageFlags.EPHEMERAL.
        data.put("flags", 64);
        resp.set("data", data);
        return resp;
    }
}

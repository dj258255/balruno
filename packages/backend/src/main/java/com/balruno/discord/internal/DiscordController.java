// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord.internal;

import com.balruno.discord.DiscordLink;
import com.balruno.discord.DiscordService;
import com.balruno.workspace.WorkspaceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST surface for Discord workspace links + interaction endpoint
 * (ADR 0030).
 *
 *   POST   /v1/workspaces/{id}/discord-links     — create / upsert
 *   GET    /v1/workspaces/{id}/discord-links     — list (token nulled)
 *   DELETE /v1/discord-links/{id}                — delete
 *   POST   /v1/discord/interactions              — public, Ed25519 verified
 */
@RestController
@Tag(name = "Discord")
class DiscordController {

    private final DiscordService discord;
    private final WorkspaceService workspaces;
    private final DiscordRepository repo;
    private final ObjectMapper json = new ObjectMapper();

    DiscordController(DiscordService discord, WorkspaceService workspaces, DiscordRepository repo) {
        this.discord = discord;
        this.workspaces = workspaces;
        this.repo = repo;
    }

    /** Membership check — caller must be a member of the target
     *  workspace. Mirrors the share / webhook controllers. */
    private void requireMember(UUID userId, UUID workspaceId) {
        var memberships = workspaces.listForUser(userId);
        var match = memberships.stream().anyMatch(w -> w.id().equals(workspaceId));
        if (!match) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.NOT_FOUND, "workspace not found");
        }
    }

    // ── Authoring (workspace member only) ───────────────────────────────

    @PostMapping(path = "/workspaces/{workspaceId}/discord-links", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    @SecurityRequirement(name = "bearerAuth")
    DiscordLink create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId,
            @RequestBody @Valid CreateRequest body) {
        var caller = callerId(jwt);
        requireMember(caller, workspaceId);
        return discord.create(caller, workspaceId, new DiscordService.CreateInput(
                body.discordGuildId(),
                body.discordApplicationId(),
                body.discordPublicKey(),
                body.discordBotToken(),
                body.defaultSheetId())).withTokenStripped();
    }

    @GetMapping(path = "/workspaces/{workspaceId}/discord-links", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    List<DiscordLink> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId) {
        var caller = callerId(jwt);
        requireMember(caller, workspaceId);
        return discord.listForWorkspace(caller, workspaceId);
    }

    @DeleteMapping(path = "/discord-links/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearerAuth")
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        var caller = callerId(jwt);
        var link = discord.findById(id);
        if (link == null) return;
        requireMember(caller, link.workspaceId());
        discord.delete(caller, id);
    }

    // ── Public interaction endpoint — Ed25519 verified ──────────────────

    @PostMapping(path = "/discord/interactions", version = "1")
    ResponseEntity<JsonNode> interactions(
            @RequestHeader(value = "X-Signature-Ed25519", required = false) String signature,
            @RequestHeader(value = "X-Signature-Timestamp", required = false) String timestamp,
            @RequestBody String rawBody) {
        if (signature == null || timestamp == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            JsonNode interaction = json.readTree(rawBody);
            var applicationId = interaction.path("application_id").asText("");
            var link = repo.findByApplicationId(applicationId);
            if (link == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            if (!Ed25519Verifier.verify(link.discordPublicKey(), signature, timestamp, rawBody)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            return ResponseEntity.ok(discord.handleInteraction(interaction));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(json.createObjectNode().put("error", e.getMessage()));
        }
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    record CreateRequest(
            @NotEmpty String discordGuildId,
            @NotEmpty String discordApplicationId,
            @NotEmpty String discordPublicKey,
            @NotEmpty String discordBotToken,
            UUID defaultSheetId
    ) {}
}

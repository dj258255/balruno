// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence layer for discord_workspace_links (ADR 0030).
 *
 * Two paths use native @Query:
 *   - {@link #upsert} — Postgres INSERT ... ON CONFLICT DO UPDATE.
 *     JPA's stock save() doesn't expose UPSERT, so native is the
 *     right tool. After upsert the service re-fetches via
 *     {@link #findByWorkspaceIdAndDiscordGuildId} to hydrate the row.
 *   - {@link #recordInteraction} — single-column UPDATE, native
 *     @Modifying skips the entity-load + dirty-check round-trip.
 */
interface DiscordRepository extends JpaRepository<DiscordLinkEntity, UUID> {

    List<DiscordLinkEntity> findByWorkspaceIdOrderByCreatedAtDesc(UUID workspaceId);

    /**
     * Lookup by application_id — Discord interactions arrive with
     * the application id in the JSON body so we know which row to
     * verify against. {@code active = true} filter is part of the
     * predicate so a disabled link can't accept a stray interaction.
     */
    Optional<DiscordLinkEntity> findFirstByDiscordApplicationIdAndActiveTrue(String applicationId);

    /**
     * Idempotent upsert keyed on (workspace_id, discord_guild_id).
     * Caller does {@link #findByWorkspaceIdAndDiscordGuildId} to
     * hydrate the resulting row.
     */
    @Modifying
    @Query(value = """
                   INSERT INTO discord_workspace_links
                       (workspace_id, discord_guild_id, discord_application_id,
                        discord_public_key, discord_bot_token, default_sheet_id, created_by)
                   VALUES (:workspaceId, :guildId, :applicationId,
                           :publicKey, :botToken, :defaultSheetId, :createdBy)
                   ON CONFLICT (workspace_id, discord_guild_id) DO UPDATE SET
                       discord_application_id = EXCLUDED.discord_application_id,
                       discord_public_key = EXCLUDED.discord_public_key,
                       discord_bot_token = EXCLUDED.discord_bot_token,
                       default_sheet_id = EXCLUDED.default_sheet_id,
                       active = true
                   """,
           nativeQuery = true)
    int upsert(@Param("workspaceId") UUID workspaceId,
               @Param("guildId") String guildId,
               @Param("applicationId") String applicationId,
               @Param("publicKey") String publicKey,
               @Param("botToken") String botToken,
               @Param("defaultSheetId") UUID defaultSheetId,
               @Param("createdBy") UUID createdBy);

    Optional<DiscordLinkEntity> findByWorkspaceIdAndDiscordGuildId(UUID workspaceId, String guildId);

    @Modifying
    @Query(value = "UPDATE discord_workspace_links "
                 + "   SET last_interaction_at = :now, last_status = :status "
                 + " WHERE id = :id",
           nativeQuery = true)
    int recordInteraction(@Param("id") UUID id,
                          @Param("now") OffsetDateTime now,
                          @Param("status") String status);
}

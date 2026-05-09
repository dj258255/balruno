// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord.internal;

import com.balruno.discord.DiscordLink;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for the discord_workspace_links table (ADR 0030).
 * One row per (workspace, guild) pair — the upsert path goes through
 * a native {@code INSERT … ON CONFLICT DO UPDATE} since JPA's
 * {@code save} doesn't expose UPSERT semantics directly.
 */
@Entity
@Table(name = "discord_workspace_links")
class DiscordLinkEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "workspace_id", nullable = false, updatable = false)
    private UUID workspaceId;

    @Column(name = "discord_guild_id", nullable = false, updatable = false)
    private String discordGuildId;

    @Column(name = "discord_application_id")
    private String discordApplicationId;

    @Column(name = "discord_public_key")
    private String discordPublicKey;

    @Column(name = "discord_bot_token")
    private String discordBotToken;

    @Column(name = "default_sheet_id")
    private UUID defaultSheetId;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "last_interaction_at")
    private OffsetDateTime lastInteractionAt;

    @Column(name = "last_status")
    private String lastStatus;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected DiscordLinkEntity() {} // JPA

    DiscordLink toDto() {
        return new DiscordLink(
                id, workspaceId, discordGuildId, discordApplicationId,
                discordPublicKey, discordBotToken, defaultSheetId, active,
                lastInteractionAt, lastStatus, createdBy, createdAt);
    }

    UUID getId() { return id; }
}

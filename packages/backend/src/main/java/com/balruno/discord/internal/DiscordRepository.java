// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.discord.internal;

import com.balruno.discord.DiscordLink;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
class DiscordRepository {

    private final JdbcTemplate jdbc;

    DiscordRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static OffsetDateTime ts(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant().atOffset(ZoneOffset.UTC);
    }

    private static final RowMapper<DiscordLink> ROW = (rs, i) -> new DiscordLink(
            rs.getObject("id", UUID.class),
            rs.getObject("workspace_id", UUID.class),
            rs.getString("discord_guild_id"),
            rs.getString("discord_application_id"),
            rs.getString("discord_public_key"),
            rs.getString("discord_bot_token"),
            rs.getObject("default_sheet_id", UUID.class),
            rs.getBoolean("active"),
            ts(rs, "last_interaction_at"),
            rs.getString("last_status"),
            rs.getObject("created_by", UUID.class),
            ts(rs, "created_at")
    );

    DiscordLink insert(UUID workspaceId, String guildId, String applicationId,
                       String publicKey, String botToken, UUID defaultSheetId,
                       UUID createdBy) {
        return jdbc.queryForObject(
                """
                INSERT INTO discord_workspace_links
                    (workspace_id, discord_guild_id, discord_application_id,
                     discord_public_key, discord_bot_token, default_sheet_id, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (workspace_id, discord_guild_id) DO UPDATE SET
                    discord_application_id = EXCLUDED.discord_application_id,
                    discord_public_key = EXCLUDED.discord_public_key,
                    discord_bot_token = EXCLUDED.discord_bot_token,
                    default_sheet_id = EXCLUDED.default_sheet_id,
                    active = true
                RETURNING id, workspace_id, discord_guild_id, discord_application_id,
                          discord_public_key, discord_bot_token, default_sheet_id,
                          active, last_interaction_at, last_status, created_by, created_at
                """,
                ROW,
                workspaceId, guildId, applicationId, publicKey, botToken,
                defaultSheetId, createdBy);
    }

    List<DiscordLink> findByWorkspaceId(UUID workspaceId) {
        return jdbc.query(
                """
                SELECT id, workspace_id, discord_guild_id, discord_application_id,
                       discord_public_key, discord_bot_token, default_sheet_id,
                       active, last_interaction_at, last_status, created_by, created_at
                FROM discord_workspace_links
                WHERE workspace_id = ?
                ORDER BY created_at DESC
                """,
                ROW, workspaceId);
    }

    DiscordLink findById(UUID id) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT id, workspace_id, discord_guild_id, discord_application_id,
                           discord_public_key, discord_bot_token, default_sheet_id,
                           active, last_interaction_at, last_status, created_by, created_at
                    FROM discord_workspace_links WHERE id = ?
                    """,
                    ROW, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    /** Lookup by application_id — interactions arrive with the application
     *  id in the JSON body so we know which row to verify against. */
    DiscordLink findByApplicationId(String applicationId) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT id, workspace_id, discord_guild_id, discord_application_id,
                           discord_public_key, discord_bot_token, default_sheet_id,
                           active, last_interaction_at, last_status, created_by, created_at
                    FROM discord_workspace_links
                    WHERE discord_application_id = ? AND active = true
                    LIMIT 1
                    """,
                    ROW, applicationId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    void delete(UUID id) {
        jdbc.update("DELETE FROM discord_workspace_links WHERE id = ?", id);
    }

    void recordInteraction(UUID id, OffsetDateTime now, String status) {
        jdbc.update(
                "UPDATE discord_workspace_links SET last_interaction_at = ?, last_status = ? WHERE id = ?",
                Timestamp.from(now.toInstant()), status, id);
    }
}

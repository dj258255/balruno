-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V19 — Discord workspace links (ADR 0030, 2026-05-08).
--
-- One row per (workspace, Discord guild). Stores the bot credentials
-- the workspace admin entered, plus the linked sheet that
-- /balruno bug commands write into.
--
-- Why per-workspace + not per-project: a Discord guild typically
-- maps to one game studio = one workspace, but a studio has many
-- projects. We pick a default sheet at install time + future
-- linked sheets via slash command params.

CREATE TABLE discord_workspace_links (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,

    -- Discord side identifiers. application_id + public_key + bot_token
    -- come from the workspace admin's Discord Developer Portal entry
    -- for their bot. We never see Discord OAuth tokens — the bot
    -- token is symmetric, used for outbound REST calls (slash cmd
    -- registration); incoming interactions are verified via
    -- public_key (Ed25519).
    discord_guild_id TEXT NOT NULL,
    discord_application_id TEXT NOT NULL,
    discord_public_key TEXT NOT NULL,
    discord_bot_token TEXT NOT NULL,

    -- Default sheet for /balruno bug commands. Optional — when null
    -- the bug command falls back to the first sheet whose name
    -- contains "bug".
    default_sheet_id UUID,

    -- Soft on/off.
    active BOOLEAN NOT NULL DEFAULT true,

    -- Diagnostic.
    last_interaction_at TIMESTAMPTZ,
    last_status TEXT,

    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (workspace_id, discord_guild_id)
);

CREATE INDEX discord_links_app_idx
    ON discord_workspace_links (discord_application_id);

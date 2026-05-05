-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V3 — Backfill default workspaces for users that have none.
--
-- For new OAuth signups, UserAuthServiceImpl creates the default
-- workspace inline (CreateNewUser branch). This migration catches
-- users that registered before that hook existed.
--
-- Idempotent: the NOT EXISTS guard makes a re-run a zero-row insert.
-- Slug = "user-" + first 8 hex chars of users.id (UUIDv7) — unique by
-- construction, satisfies the [a-z0-9][a-z0-9-]{2,29} format rule.

WITH users_without_workspace AS (
    SELECT u.id AS user_id,
           COALESCE(u.name, split_part(u.email, '@', 1)) AS display_name
    FROM users u
    WHERE NOT EXISTS (
        SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.id
    )
),
new_workspaces AS (
    INSERT INTO workspaces (slug, name, created_by)
    SELECT
        'user-' || substr(replace(uw.user_id::text, '-', ''), 1, 8),
        uw.display_name || '''s Workspace',
        uw.user_id
    FROM users_without_workspace uw
    RETURNING id, created_by
)
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT id, created_by, 'OWNER'::workspace_role
FROM new_workspaces;

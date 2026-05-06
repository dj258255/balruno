-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V5 — workspace_plan ENUM + workspaces.plan column.
--
-- Owner module: com.balruno.workspace. Per-workspace billing model
-- (FREE / PRO / TEAM). All existing rows backfill to FREE; PRO/TEAM
-- become reachable once the subscriptions surface lands. The limits
-- themselves live in code (WorkspaceLimits), not DB rows — quota
-- adjustments are a single-line constant change + redeploy.

CREATE TYPE workspace_plan AS ENUM ('FREE', 'PRO', 'TEAM');

ALTER TABLE workspaces
    ADD COLUMN plan workspace_plan NOT NULL DEFAULT 'FREE';

-- Hot path: "how many active workspaces did this user create?" — the
-- guard for the FREE-tier owned-workspaces cap calls this on every
-- workspace create.
CREATE INDEX workspaces_created_by_active_idx
    ON workspaces (created_by) WHERE deleted_at IS NULL;

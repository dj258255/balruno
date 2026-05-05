-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V4 — projects (containers for sheets / documents inside a workspace).
--
-- Owner module: com.balruno.project. Permissions inherit from the
-- parent workspace's role: Viewer can read, Builder can create / edit /
-- delete (structural change). Slug is unique per workspace — different
-- workspaces can each have a "main" project without colliding.

CREATE TABLE projects (
    id            UUID         PRIMARY KEY DEFAULT uuidv7(),
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    slug          VARCHAR(30)  NOT NULL,
    name          VARCHAR(120) NOT NULL,
    description   TEXT,
    created_by    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

-- Slug uniqueness scoped to active rows within a workspace.
CREATE UNIQUE INDEX projects_workspace_slug_active_uk
    ON projects (workspace_id, slug) WHERE deleted_at IS NULL;

-- "List the active projects of this workspace" is the hot path.
CREATE INDEX projects_workspace_active_idx
    ON projects (workspace_id) WHERE deleted_at IS NULL;

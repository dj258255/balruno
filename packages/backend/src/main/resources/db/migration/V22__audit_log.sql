-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V22 — Audit log (ADR 0032, 2026-05-08).
--
-- One row per noteworthy workspace action. Surfaced to the
-- workspace settings panel as 'who did what when', and gated to
-- the TEAM tier per ADR 0016.
--
-- Resource model: action is a string like 'project.created',
-- 'workspace.member.added', 'comment.deleted'. resource_type +
-- resource_id locate the affected entity. payload (JSONB)
-- carries diff hints — small enough that storing full row state
-- per audit entry would be wasteful at scale.

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users (id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Listing for the settings panel: by workspace, newest first,
-- optional resource filter. UUIDv7 PK ordering = created_at order
-- so the index covers the common query without a separate sort.
CREATE INDEX audit_log_workspace_id_idx
    ON audit_log (workspace_id, id DESC);

CREATE INDEX audit_log_resource_idx
    ON audit_log (resource_type, resource_id)
    WHERE resource_id IS NOT NULL;

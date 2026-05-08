-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V22 — Workspace activity audit log (ADR 0032, 2026-05-08).
--
-- V1 already shipped an `audit_log` for *identity* events (oauth.link,
-- login.success, refresh.theft_detected, ...). This is a separate
-- log scoped to *workspace activity* — who created which project,
-- who deleted which comment, role changes, etc.
--
-- Different lifecycle: identity log is per-user across all workspaces
-- and lives forever; workspace log is per-workspace, surfaces in the
-- TEAM-tier settings panel (ADR 0016), and may eventually retain on
-- a configurable window.

CREATE TABLE workspace_audit_log (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users (id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workspace_audit_log_workspace_id_idx
    ON workspace_audit_log (workspace_id, id DESC);

CREATE INDEX workspace_audit_log_resource_idx
    ON workspace_audit_log (resource_type, resource_id)
    WHERE resource_id IS NOT NULL;

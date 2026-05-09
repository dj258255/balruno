-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V28 — workspace storage usage tracking (Phase D, ADR 0024 stage attach).
--
-- Tracks the cumulative bytes uploaded under each workspace for the
-- attachment quota (WorkspaceLimits.maxAttachmentBytes). Single-row-
-- per-workspace by design — the per-attachment row would only matter
-- for orphan cleanup, and that lives in R2's object listing or a
-- lifecycle rule rather than a sidecar table.
--
-- The bytes counter is mutated transactionally with the upload row /
-- delete row in WorkspaceStorageService. Concurrent uploads use
-- SELECT ... FOR UPDATE to serialise the read-modify-write so the
-- quota check + increment can never race past the cap.

CREATE TABLE workspace_storage (
    workspace_id  UUID         PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    total_bytes   BIGINT       NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Backfill — every workspace gets a row with 0 bytes so the upload path
-- can rely on UPDATE without a INSERT-OR-UPDATE branch. Soft-deleted
-- workspaces are excluded (deleted_at IS NULL).
INSERT INTO workspace_storage (workspace_id, total_bytes)
SELECT id, 0
FROM workspaces
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

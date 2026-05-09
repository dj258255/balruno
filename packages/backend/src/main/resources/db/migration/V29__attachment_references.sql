-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V29 — attachment reference tracking (Tier 2b orphan cleanup).
--
-- Each row claims that one piece of content (comment / doc / cell)
-- references an attachment blob. When the content is removed (comment
-- soft-delete, project soft-delete cascade), refs are cleaned up; if a
-- blob ends up with zero refs the storage layer deletes the R2 / LocalFs
-- bytes and decrements the workspace counter.
--
-- Doc-body image removal isn't hooked yet (Y.Doc state lives in
-- Hocuspocus, not directly in PG). Those orphans get swept by the
-- project soft-delete cascade or — at worst — accumulate until the
-- owning project is deleted. Reconciliation against doc bodies is a
-- follow-up phase.

CREATE TABLE attachment_references (
    id                UUID         PRIMARY KEY DEFAULT uuidv7(),
    attachment_path   TEXT         NOT NULL,
    workspace_id      UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    ref_kind          TEXT         NOT NULL,
    ref_id            UUID         NOT NULL,
    size_bytes        BIGINT       NOT NULL CHECK (size_bytes >= 0),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT attachment_ref_kind_chk
        CHECK (ref_kind IN ('comment', 'doc', 'cell'))
);

-- Path-level lookup: "how many refs to this blob?" for delete decision.
CREATE INDEX attachment_refs_path_ix ON attachment_references (attachment_path);
-- Content-level lookup: "remove all refs from this comment/doc/cell".
CREATE INDEX attachment_refs_kind_id_ix ON attachment_references (ref_kind, ref_id);
-- Workspace-level for quota auditing.
CREATE INDEX attachment_refs_workspace_ix ON attachment_references (workspace_id);

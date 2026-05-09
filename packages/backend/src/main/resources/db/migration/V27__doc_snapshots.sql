-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V27 — doc_snapshots — sparse yjs state snapshots for the doc body
-- page-history surface (ADR 0038 stage C).
--
-- Owner split mirrors V7 documents: the schema is defined here, the
-- writes happen on the collab (Hocuspocus / Node) side inside the
-- onStoreDocument hook with a throttle ('every 50 updates OR every 5
-- minutes since last snapshot, whichever first'). Spring backend
-- only reads — exposes a list endpoint + a single-snapshot binary
-- download for the page-history UI.
--
-- Why sparse: every keystroke triggers a Hocuspocus store after a
-- short debounce; persisting one snapshot per store would balloon
-- to thousands of rows for a half-hour writing session. Notion /
-- Outline / AFFiNE all surface 'snapshot moments', not 'every
-- keystroke', for the same reason.

CREATE TABLE doc_snapshots (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    doc_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    -- Optional — null when the snapshot fired on a system trigger
    -- (idle timeout w/o an active connection). Resolved off the
    -- collab token's subject claim when present.
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Y.encodeStateAsUpdate(doc) — same shape Hocuspocus already
    -- writes to documents.ydoc_state.
    yjs_state   BYTEA NOT NULL,
    -- First N chars of plain-text body — preview shown in the
    -- page-history list without having to download the full state.
    -- Optional: collab can leave it null when traversal is non-
    -- trivial (rich-text node walk).
    summary     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Page-history list — newest first per doc.
CREATE INDEX doc_snapshots_doc_idx ON doc_snapshots (doc_id, created_at DESC);

-- Retention scheduler will scan this index to prune rows past the
-- workspace plan's historyRetentionDays (FREE 14 / PRO 60 / TEAM 180).
CREATE INDEX doc_snapshots_created_idx ON doc_snapshots (created_at);

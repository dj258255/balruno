-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V25 — projects.sort_key for sidebar drag-drop reorder.
--
-- ADR 0011 flagged fractional position (lexorank) as the Stage 2+
-- pattern for tree reordering. Frontend now uses it for the
-- workspace project list: each project carries a base-26 string
-- key (e.g. 'a', 'b', 'an', 'ao') and the order is the natural
-- lexicographic sort. Insert between two siblings = generate a key
-- between their two keys; only one row updates per drag.
--
-- Default 'a' is intentionally the lowest key so newly created
-- projects after backfill don't accidentally land in the middle of
-- the existing list — they go to the end in created_at order via
-- the suffix scheme below.
--
-- Backfill: existing rows get keys derived from row_number() over
-- (workspace_id, created_at), encoded as a left-padded base-26
-- string so subsequent inserts can always find an open slot
-- between two existing keys without rebalancing.

ALTER TABLE projects
    ADD COLUMN sort_key TEXT NOT NULL DEFAULT 'a';

-- Backfill: 'a', 'b', ..., 'z', 'ba', 'bb', ... per workspace,
-- ordered by created_at. Keys are 1-26 digits in base 26 with
-- digits a..z. The trailing 'm' (= 13) seeds keys in the middle of
-- the alphabetic range so future inserts at either end don't have
-- to rebalance.
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY workspace_id
        ORDER BY created_at, id
    ) AS rn
    FROM projects
)
UPDATE projects p
SET sort_key = CASE
    WHEN n.rn <= 26 THEN chr(96 + n.rn::int) || 'm'
    ELSE chr(96 + ((n.rn - 1) / 26)::int)
       || chr(96 + ((n.rn - 1) % 26 + 1)::int) || 'm'
END
FROM numbered n
WHERE p.id = n.id;

-- Per-workspace ordering index. The active-row filter mirrors the
-- repository's findBy...DeletedAtIsNull query so soft-deleted rows
-- don't pollute the index.
CREATE INDEX idx_projects_workspace_sort_key
    ON projects (workspace_id, sort_key)
    WHERE deleted_at IS NULL;

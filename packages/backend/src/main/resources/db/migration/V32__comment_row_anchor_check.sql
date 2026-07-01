-- V32 — Widen the comment scope/anchor invariant to allow SHEET_ROW
-- (record-level) comments: sheet_id + row_id set, column_id NULL.
--
-- V30 had narrowed comments_scope_anchor_check to SHEET_CELL-only when
-- it dropped the doc-body columns. Recreate it with the SHEET_ROW arm.
-- Separate migration from V31 because it references the newly added
-- enum value (see V31 header).
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_scope_anchor_check;
ALTER TABLE comments ADD CONSTRAINT comments_scope_anchor_check CHECK (
    (scope_kind = 'SHEET_CELL'
     AND sheet_id IS NOT NULL AND row_id IS NOT NULL AND column_id IS NOT NULL)
 OR (scope_kind = 'SHEET_ROW'
     AND sheet_id IS NOT NULL AND row_id IS NOT NULL AND column_id IS NULL)
);

-- Partial index mirroring comments_sheet_cell_idx for the row lookup.
CREATE INDEX IF NOT EXISTS comments_sheet_row_idx
    ON comments (project_id, sheet_id, row_id)
    WHERE scope_kind = 'SHEET_ROW' AND deleted_at IS NULL;

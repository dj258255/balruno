-- V10 — Backfill a default project for workspaces that have none.
--
-- UserAuthServiceImpl.findOrCreateOnOAuth seeds a starter project on
-- a brand-new account (commit landing alongside this migration), but
-- workspaces that already exist (the early adopters' V3-backfilled
-- default workspace + workspaces created before the seed code) still
-- have zero projects, so the SPA's project-list page renders empty.
-- Mirror the pattern of V3 (default workspace backfill) and V9 (default
-- sheet within data) — same shape, scoped to "no active project".
--
-- The seeded project carries one starter sheet (one general column,
-- one empty row) so SheetCellOpService has an addressable
-- (sheetId, rowId, columnId) for the very first cell.update on the
-- minimal cell editor. Same JSON shape ProjectServiceImpl.create's
-- buildDefaultSheetJson emits at runtime — kept in sync deliberately.
--
-- Idempotency: NOT EXISTS guard + scoped to active rows (deleted_at
-- IS NULL on both sides). A workspace with a soft-deleted project
-- still gets a fresh default; a workspace with any active project
-- is untouched.

INSERT INTO projects (workspace_id, slug, name, created_by, data)
SELECT
    w.id                                     AS workspace_id,
    'main'                                   AS slug,
    '내 첫 게임'                             AS name,
    w.created_by                             AS created_by,
    jsonb_build_array(
        jsonb_build_object(
            'id', uuidv7()::text,
            'name', 'Sheet 1',
            'columns', jsonb_build_array(
                jsonb_build_object(
                    'id', uuidv7()::text,
                    'name', 'Column 1',
                    'type', 'general'
                )
            ),
            'rows', jsonb_build_array(
                jsonb_build_object(
                    'id', uuidv7()::text,
                    'cells', '{}'::jsonb
                )
            ),
            'createdAt', floor(extract(epoch from now()) * 1000),
            'updatedAt', floor(extract(epoch from now()) * 1000)
        )
    )                                        AS data
FROM workspaces w
WHERE w.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.workspace_id = w.id
        AND p.deleted_at IS NULL
  );

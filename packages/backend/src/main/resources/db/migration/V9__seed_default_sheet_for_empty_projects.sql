-- V9 — Backfill the default starter sheet for projects whose data is empty.
--
-- ProjectServiceImpl.create started seeding `data` with a single starter
-- sheet (one column + one row) at commit 3e506a5 / E.2.a so a newly
-- minted project hits the SheetTable / minimal cell editor with an
-- addressable (sheetId, rowId, columnId) tuple. Pre-existing projects
-- created before that change carry an empty payload — either the old
-- entity default '{}' (object) or the V8 column default '[]' (empty
-- array) — and the frontend stalls at "sync.full 응답을 기다리는 중..."
-- because there is nothing to render.
--
-- This migration replaces those empty payloads with the same shape the
-- service-side seed produces. Projects that already have at least one
-- sheet (jsonb_typeof = 'array' AND jsonb_array_length > 0) are left
-- untouched.
--
-- IDs use uuidv7() (PG 18 native, ADR 0012 v1.1) — the embedded sheet /
-- column / row ids are nested data ids inside the JSON tree, not DB
-- PKs, so any UUID flavour is fine; v7 keeps them time-ordered for
-- consistency with the rest of the codebase.

UPDATE projects
SET data = jsonb_build_array(
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
)
WHERE jsonb_typeof(data) <> 'array'
   OR jsonb_array_length(data) = 0;

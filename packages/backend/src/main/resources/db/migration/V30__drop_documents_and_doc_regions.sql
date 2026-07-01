-- V30 — Drop the document (Pattern B / yjs-Hocuspocus) feature schema.
--
-- The collaborative rich-text document surface was removed in favour of a
-- sheet-only model (long-text fields + cell/row comments). All Java code
-- referencing the tables/columns below was stripped first, so this forward
-- migration only tears down the now-orphaned schema.
--
-- Ordering respects FKs: doc_snapshots -> comments.document_id ->
-- documents -> projects.doc_tree columns -> op_idempotency doc rows.
--
-- NOTE: PostgreSQL cannot remove ENUM values, so op_scope_kind still
-- carries 'DOC_TREE' and comment_scope_kind still carries 'DOC_BODY'.
-- Both are harmless — no code emits them. Leaving them avoids the risky
-- drop-default / recast dance against live data.

-- 1. Doc page-history snapshots (FK -> documents, projects, users).
DROP TABLE IF EXISTS doc_snapshots;

-- 2. Detach comments from documents. Purge doc-body comments (data loss,
--    acceptable — near-zero users, irreversible), drop the doc index and
--    the anchor columns, then re-assert the SHEET_CELL-only invariant.
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_scope_anchor_check;
DROP INDEX IF EXISTS comments_doc_body_idx;
DELETE FROM comments WHERE scope_kind = 'DOC_BODY';
ALTER TABLE comments DROP COLUMN IF EXISTS document_id;      -- drops FK -> documents
ALTER TABLE comments DROP COLUMN IF EXISTS anchor_position;
ALTER TABLE comments DROP COLUMN IF EXISTS anchor_length;
ALTER TABLE comments ADD CONSTRAINT comments_scope_anchor_check CHECK (
    scope_kind = 'SHEET_CELL'
    AND sheet_id  IS NOT NULL
    AND row_id    IS NOT NULL
    AND column_id IS NOT NULL
);

-- 3. Document bodies (yjs encoded state).
DROP TABLE IF EXISTS documents;

-- 4. The doc-tree sync region on projects.
DROP INDEX IF EXISTS projects_doc_tree_gin;
ALTER TABLE projects DROP COLUMN IF EXISTS doc_tree;
ALTER TABLE projects DROP COLUMN IF EXISTS doc_tree_version;

-- 5. Purge orphaned op-log idempotency rows for the removed doc region.
DELETE FROM op_idempotency WHERE scope_kind = 'DOC_TREE';

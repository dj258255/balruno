-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V21 — Project-wide search indexes (ADR 0031, 2026-05-08).
--
-- pg_trgm GIN indexes give us cheap substring search across:
--   * sheet cell values (projects.data JSONB cells)
--   * sheet / doc tree node names (projects.sheet_tree, doc_tree)
--   * comment bodies (comments.body_json)
--
-- We index the JSONB::text representation rather than running
-- pg_trgm directly on the JSONB — keeps the index simple, accepts
-- some noise from struct keys (column ids etc.) which the
-- application-side filter trims.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX projects_data_text_trgm_idx
    ON projects USING gin ((data::text) gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX projects_sheet_tree_text_trgm_idx
    ON projects USING gin ((sheet_tree::text) gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX projects_doc_tree_text_trgm_idx
    ON projects USING gin ((doc_tree::text) gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX comments_body_text_trgm_idx
    ON comments USING gin ((body_json::text) gin_trgm_ops)
    WHERE deleted_at IS NULL;

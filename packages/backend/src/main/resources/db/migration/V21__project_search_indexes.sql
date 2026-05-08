-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V21 — Project-wide search indexes (ADR 0031, 2026-05-08).
--
-- v1: ILIKE scan against projects.data + comments.body_json (cast
-- to text inside SearchController). Adequate at sub-100k-row scale
-- where the controller already loads the full project row to walk
-- JSON anyway.
--
-- Original plan was a pg_trgm GIN index on (data::text), but the
-- jsonb→text cast isn't IMMUTABLE so PostgreSQL rejects it as an
-- index expression. The proper v2 path is a generated stored
-- column (`data_text TEXT GENERATED ALWAYS AS (data::text) STORED`)
-- or a TSVECTOR with a trigger. Deferred until query latency in
-- the wild justifies the storage cost.
--
-- Slot reserved with a no-op so subsequent migrations keep their
-- V22+ numbering when the real index ships.
DO $$
BEGIN
    NULL;
END $$;

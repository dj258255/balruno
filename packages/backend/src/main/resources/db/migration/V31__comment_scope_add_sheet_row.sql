-- V31 — Add the SHEET_ROW (record-level) comment scope value.
--
-- MUST be its own migration, separate from the V32 CHECK recreation:
-- PostgreSQL forbids referencing a newly added enum value in the same
-- transaction that adds it, and V32 casts 'SHEET_ROW'::comment_scope_kind.
-- Flyway wraps each migration in one transaction, so the ADD VALUE here
-- commits before V32 uses it.
ALTER TYPE comment_scope_kind ADD VALUE IF NOT EXISTS 'SHEET_ROW';

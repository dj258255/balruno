-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V12 — anchor_length on comments (ADR 0024 Stage F.2 highlight).
--
-- V11 stored anchor_position (Tiptap doc offset) but not the length
-- of the anchored range, so the panel could pin the comment to a
-- single offset but the editor couldn't render an underline span.
-- F.2 needs both: the (from, to) pair lets the ProseMirror plugin
-- emit a Decoration.inline that highlights the original selection.
--
-- Backfill: NULL means "doc-level comment" (no range) — same shape
-- as anchor_position. New range-pinned comments fill both columns.
-- Old comments (any pre-F.2 row) keep NULL on both.

ALTER TABLE comments
    ADD COLUMN anchor_length INT;

-- Re-state the SHEET_CELL anchor invariant from V11 verbatim. The
-- earlier check (sheet+row+column) is unaffected; we only add a
-- new constraint covering the length / position pairing for DOC.
ALTER TABLE comments
    ADD CONSTRAINT comment_anchor_length_with_position
    CHECK (
        anchor_length IS NULL
        OR (anchor_position IS NOT NULL AND anchor_length > 0)
    );

COMMENT ON COLUMN comments.anchor_length IS
    'Length of the Tiptap-anchored range (offset = anchor_position, end = anchor_position + anchor_length). NULL = doc-level (no range). Always paired with anchor_position when non-null.';

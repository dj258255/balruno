-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V26 — Cell + tree history table for user-facing change log (ADR 0038).
--
-- Lifecycle is intentionally separate from op_idempotency (V8). That
-- table caches results for clientMsgId replay during disconnect (7-day
-- retention is plenty); this one feeds a sheet/row Activity tab and
-- needs to live as long as the workspace plan's history retention
-- (FREE 14d / PRO 60d / TEAM 180d, see WorkspaceLimits).
--
-- Writes happen via an AFTER_COMMIT TransactionSynchronization in the
-- sync module — same pattern AuditLogEvent uses (ADR 0032). The main
-- TreeOpService / SheetCellOpService hot path stays free of an extra
-- INSERT inside the transaction.

CREATE TABLE cell_history (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sheet_id    UUID NOT NULL,
    -- row_id is null for column-level / sheet-level events (e.g.
    -- column.add). column_id is null for row-level / cell-removed
    -- events. Filtering surfaces query on row + column = exact cell.
    row_id      UUID,
    column_id   UUID,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    -- e.g. 'cell.update', 'row.add', 'row.delete', 'column.update'.
    -- The frontend resolves a friendly label per action (i18n).
    action      TEXT NOT NULL,
    -- Per-action JSONB cargo. cell.update stores { before, after }
    -- so the frontend can render '200 → 220' inline. row.add stores
    -- the seeded cells map. column.update stores the field patch.
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot path — row-scoped Activity tab.
CREATE INDEX cell_history_row_idx
    ON cell_history (project_id, sheet_id, row_id, created_at DESC)
    WHERE row_id IS NOT NULL;

-- Sheet-scoped fallback (sheet activity stream, future surface).
CREATE INDEX cell_history_sheet_idx
    ON cell_history (project_id, sheet_id, created_at DESC);

-- Cleanup scheduler (Spring @Scheduled) walks this index when
-- pruning rows past the workspace plan's retention. Added as a
-- separate index so the row-scoped index above stays narrow.
CREATE INDEX cell_history_created_idx ON cell_history (created_at);

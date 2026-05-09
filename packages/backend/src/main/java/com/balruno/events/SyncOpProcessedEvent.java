// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Fires once a sync op (cell.update / row.* / column.*) has been
 * applied to the project state and committed (ADR 0038 Stage A).
 *
 * The history module subscribes and writes a {@code cell_history}
 * row so the row's Activity tab + cell-level popover have a
 * user-facing change log to draw from. The lifecycle is independent
 * of {@code op_idempotency} (sync replay cache, 7-day retention) —
 * cell_history follows the workspace plan's
 * {@code historyRetentionDays} (FREE 14 / PRO 60 / TEAM 180).
 *
 * Publishers (TreeOpService / SheetCellOpService) emit this on
 * {@link org.springframework.transaction.support.TransactionSynchronization#afterCommit()}
 * so a rolled-back op never leaves a phantom history row.
 *
 * <p>Sheet/row/column ids may be null depending on the action:
 * <ul>
 *   <li>cell.update — sheetId + rowId + columnId all set</li>
 *   <li>row.add / row.delete / row.move — sheetId + rowId, columnId null</li>
 *   <li>column.* — sheetId + columnId, rowId null</li>
 * </ul></p>
 */
public record SyncOpProcessedEvent(
        UUID projectId,
        UUID sheetId,
        UUID rowId,
        UUID columnId,
        UUID actorUserId,
        String action,
        JsonNode payload
) {}

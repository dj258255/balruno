// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public read model for a {@code cell_history} row (ADR 0038).
 *
 * Mirrors {@link com.balruno.audit.AuditEntry} but for sheet
 * cell-level / tree-level changes — sheet id + optional row + column
 * + arbitrary action payload (cell.update before/after, column patch,
 * etc.). Frontend resolves a friendly per-action label via i18n.
 */
public record HistoryEntry(
        UUID id,
        UUID projectId,
        UUID sheetId,
        UUID rowId,
        UUID columnId,
        UUID actorUserId,
        String action,
        JsonNode payload,
        OffsetDateTime createdAt
) {}

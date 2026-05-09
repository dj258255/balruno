// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history;

import java.util.List;
import java.util.UUID;

/**
 * Outbound API of the cell/tree history module (ADR 0038).
 *
 * Authorisation goes through the workspace module's
 * {@code requireRole} via the project's owning workspace — read
 * needs Viewer or higher.
 */
public interface HistoryService {

    /**
     * Most-recent-first activity for a single row in a sheet. Caller
     * must be a Viewer+ on the project's workspace. Result is
     * already cut off at the workspace plan's
     * {@code historyRetentionDays} — older rows aren't returned even
     * if they're still in the table (cleanup runs daily but this
     * filter is the source of truth from the user's POV).
     */
    List<HistoryEntry> listForRow(UUID projectId, UUID sheetId, UUID rowId,
                                  UUID callerUserId, int limit);

    /** Sheet-wide newest-first activity (column.* + sheet-level events + row events). */
    List<HistoryEntry> listForSheet(UUID projectId, UUID sheetId,
                                    UUID callerUserId, int limit);
}

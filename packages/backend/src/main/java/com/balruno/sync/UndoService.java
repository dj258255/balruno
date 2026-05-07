// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Server-backed undo / redo (ADR 0021 v2.3 Phase 5, Pattern C).
 *
 * Each user op write goes into op_idempotency with both forward + inverse
 * payloads (V14). Cmd+Z calls {@link #undo} which pops the latest
 * reversible action by (user, project, browser tab) within the 120-min
 * window (Baserow MINUTES_UNTIL_ACTION_CLEANED_UP), applies the inverse
 * via existing op handlers, and marks the row {@code is_undone}.
 * Cmd+Shift+Z calls {@link #redo} — symmetric on the redo stack.
 *
 * Per-tab isolation: clientSessionId scopes the lookup so different
 * browser tabs of the same project have independent histories
 * (Baserow's ClientUndoRedoActionGroupId pattern).
 */
public interface UndoService {

    /**
     * Pop the latest reversible action by this user in this project +
     * tab. Apply its inverse_payload via existing op apply paths
     * (broadcasting the resulting ops to peers as part of the standard
     * apply flow). Mark the row {@code is_undone} so it's eligible for
     * redo.
     */
    UndoResult undo(UUID callerUserId, UUID projectId, UUID clientSessionId);

    /**
     * Pop the latest already-undone action and re-apply its
     * forward_payload. Mark the row {@code is_undone = false} so the
     * next undo call can pop it again.
     */
    UndoResult redo(UUID callerUserId, UUID projectId, UUID clientSessionId);

    /**
     * Result envelope. {@code Applied} carries the action group + the
     * ops that were applied so the calling client can update its UI
     * (e.g. show a toast "Undid your last action"). {@code NothingToUndo}
     * means the user's stack is empty (or all entries past the 120-min
     * window) — frontend disables the Cmd+Z button.
     */
    sealed interface UndoResult {
        record Applied(
                UUID actionGroupId,
                JsonNode appliedOps
        ) implements UndoResult {}

        record NothingToUndo() implements UndoResult {}
    }
}

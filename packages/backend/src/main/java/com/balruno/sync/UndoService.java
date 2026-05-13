// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
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
     * Frontend-mount hydrate. Returns the user's last N reversible
     * actions in this tab, newest first, so the client can pre-fill
     * its local Cmd+Z stack after a page refresh.
     *
     * Response items mirror the same UndoResult.Applied shape so the
     * client can reuse a single decoder. Each entry is a self-
     * contained record — clientMsgId for dedup, forward + inverse
     * arrays, actionGroupId for grouping, createdAt for chronological
     * display.
     */
    java.util.List<UndoStackEntry> recentReversible(
            UUID callerUserId, UUID projectId, UUID clientSessionId, int limit);

    record UndoStackEntry(
            UUID clientMsgId,
            UUID actionGroupId,
            JsonNode forward,
            JsonNode inverse,
            boolean undone,
            java.time.OffsetDateTime createdAt
    ) {}

    /**
     * Result envelope. {@code Applied} carries the action group + the
     * ops that were applied so the calling client can update its UI
     * (e.g. show a toast "Undid your last action"). {@code NothingToUndo}
     * means the user's stack is empty (or all entries past the 120-min
     * window) — frontend disables the Cmd+Z button.
     *
     * The {@code @JsonTypeInfo} + {@code @JsonSubTypes} annotation
     * pair injects a {@code "type": "Applied" | "NothingToUndo"} field
     * into the serialised response so the frontend can switch on it.
     * Without it, {@code NothingToUndo} serialises as {@code {}} and
     * {@code Applied} as {@code {actionGroupId, appliedOps}} — the
     * frontend's {@code msg.type === 'Applied'} discriminator stays
     * undefined and Cmd+Z visually no-ops even though the server
     * executed the undo correctly.
     */
    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
    @JsonSubTypes({
            @JsonSubTypes.Type(value = UndoResult.Applied.class, name = "Applied"),
            @JsonSubTypes.Type(value = UndoResult.NothingToUndo.class, name = "NothingToUndo"),
    })
    sealed interface UndoResult {
        record Applied(
                UUID actionGroupId,
                JsonNode appliedOps
        ) implements UndoResult {}

        record NothingToUndo() implements UndoResult {}
    }
}

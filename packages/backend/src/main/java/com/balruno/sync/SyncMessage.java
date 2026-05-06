// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync;

// Jackson 3 keeps the annotation artifact under the legacy
// com.fasterxml.jackson.annotation package — only databind moved to
// tools.jackson. This is intentional in the Jackson 3 line, not a typo.
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.util.UUID;

/**
 * Wire schema for the {@code /ws/projects/{id}} channel — ADR 0008 v2.0
 * §2.2 verbatim. Sealed interface + records gives us exhaustive switch
 * in the handler and keeps the JSON shape literal-equal to what the
 * frontend already consumes (lib/backend mirrors).
 *
 * Three op log regions ride this single channel:
 *   - sheet cell ops (cell.update / row.* / column.*)
 *   - sheet tree ops (tree.* with treeKind=SHEET)
 *   - doc tree ops   (tree.* with treeKind=DOC)
 *
 * The fourth region (document body, yjs binary) lives on the separate
 * Hocuspocus channel — never travels through this interface.
 *
 * Stage B.1 scope: schema only. The handler that decodes / dispatches
 * lands in Stage B.4-B.5.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        // ── client → server ──────────────────────────────────────────
        @JsonSubTypes.Type(value = SyncMessage.CellUpdate.class,    name = "cell.update"),
        @JsonSubTypes.Type(value = SyncMessage.RowAdd.class,        name = "row.add"),
        @JsonSubTypes.Type(value = SyncMessage.RowDelete.class,     name = "row.delete"),
        @JsonSubTypes.Type(value = SyncMessage.RowMove.class,       name = "row.move"),
        @JsonSubTypes.Type(value = SyncMessage.ColumnAdd.class,     name = "column.add"),
        @JsonSubTypes.Type(value = SyncMessage.ColumnUpdate.class,  name = "column.update"),
        @JsonSubTypes.Type(value = SyncMessage.ColumnDelete.class,  name = "column.delete"),
        @JsonSubTypes.Type(value = SyncMessage.TreeAdd.class,       name = "tree.add"),
        @JsonSubTypes.Type(value = SyncMessage.TreeMove.class,      name = "tree.move"),
        @JsonSubTypes.Type(value = SyncMessage.TreeDelete.class,    name = "tree.delete"),
        @JsonSubTypes.Type(value = SyncMessage.TreeRename.class,    name = "tree.rename"),
        @JsonSubTypes.Type(value = SyncMessage.Presence.class,      name = "presence"),
        // ── server → client ──────────────────────────────────────────
        @JsonSubTypes.Type(value = SyncMessage.SyncFull.class,      name = "sync.full"),
        @JsonSubTypes.Type(value = SyncMessage.Conflict.class,      name = "conflict"),
        @JsonSubTypes.Type(value = SyncMessage.OpAcked.class,       name = "op.acked"),
})
public sealed interface SyncMessage {

    /** Document tree differs from sheet tree only in target region; same op shape. */
    enum TreeKind { SHEET, DOC }

    /** Conflict scope = which version column tripped. */
    enum ConflictScope { SHEET_CELL, SHEET_TREE, DOC_TREE }

    // ── client → server (op log writes) ───────────────────────────────

    record CellUpdate(
            UUID sheetId, UUID rowId, UUID columnId,
            Object value,
            long baseVersion, UUID clientMsgId
    ) implements SyncMessage {}

    record RowAdd(UUID sheetId, Object row, long baseVersion, UUID clientMsgId) implements SyncMessage {}
    record RowDelete(UUID sheetId, UUID rowId, long baseVersion, UUID clientMsgId) implements SyncMessage {}
    record RowMove(UUID sheetId, UUID rowId, int toIndex, long baseVersion, UUID clientMsgId) implements SyncMessage {}

    record ColumnAdd(UUID sheetId, Object column, long baseVersion, UUID clientMsgId) implements SyncMessage {}
    record ColumnUpdate(UUID sheetId, UUID columnId, Object patch, long baseVersion, UUID clientMsgId) implements SyncMessage {}
    record ColumnDelete(UUID sheetId, UUID columnId, long baseVersion, UUID clientMsgId) implements SyncMessage {}

    record TreeAdd(
            TreeKind treeKind, UUID parentId, int position, Object node,
            long baseVersion, UUID clientMsgId
    ) implements SyncMessage {}

    record TreeMove(
            TreeKind treeKind, UUID nodeId, UUID newParentId, int newPosition,
            long baseVersion, UUID clientMsgId
    ) implements SyncMessage {}

    record TreeDelete(TreeKind treeKind, UUID nodeId, long baseVersion, UUID clientMsgId) implements SyncMessage {}
    record TreeRename(TreeKind treeKind, UUID nodeId, String newName, long baseVersion, UUID clientMsgId) implements SyncMessage {}

    /**
     * Presence is fire-and-forget — no version, no idempotency. Cursor
     * shape is region-specific (sheet has sheetId/rowId/columnId, doc
     * has docId) so we keep it as a free-form object until the frontend
     * cursor types stabilise.
     */
    record Presence(UUID userId, Object cursor) implements SyncMessage {}

    // ── server → client (broadcast + replies) ─────────────────────────

    /**
     * Initial hydrate after connect. {@code projectState} carries the
     * three JSONB blobs (data / sheet_tree / doc_tree); {@code versions}
     * the matching counters so the client knows what {@code baseVersion}
     * to send back on its first op.
     */
    record SyncFull(Object projectState, Versions versions) implements SyncMessage {
        public record Versions(long data, long sheetTree, long docTree) {}
    }

    record Conflict(ConflictScope scope, Object op, long serverVersion) implements SyncMessage {}

    /** Replay of a previously-processed op — same clientMsgId hits op_idempotency cache. */
    record OpAcked(UUID clientMsgId, long version) implements SyncMessage {}
}

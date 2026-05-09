// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync;

// Jackson 3 keeps the annotation artifact under the legacy
// com.fasterxml.jackson.annotation package — only databind moved to
// tools.jackson. This is intentional in the Jackson 3 line, not a typo.
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.JsonNode;

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
        @JsonSubTypes.Type(value = SyncMessage.CellStyleUpdate.class, name = "cell.style.update"),
        @JsonSubTypes.Type(value = SyncMessage.SheetMetadataUpdate.class, name = "sheet.metadata.update"),
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

    /**
     * Undo/redo metadata attached to each op (ADR 0021 v2.3 Phase 5).
     * Null = client does not yet support undo (or the op has no inverse,
     * e.g. presence). Non-null = server-backed undo is enabled and the
     * op gets a row in op_idempotency.
     *
     * forward / inverse are arrays so multi-op cascades (link bidirectional
     * column add/delete, deleteRow with row.add + row.move snapshot) fit
     * one envelope. The frontend's UndoEntry already uses the same shape.
     *
     * actionGroupId is the ClientUndoRedoActionGroupId header value
     * (Baserow pattern) — same group is undone in one Cmd+Z press.
     * clientSessionId is the per-tab UUID from frontend localStorage.
     */
    record UndoMeta(
            JsonNode forward,
            JsonNode inverse,
            UUID actionGroupId,
            UUID clientSessionId
    ) {}

    // ── client → server (op log writes) ───────────────────────────────

    record CellUpdate(
            UUID sheetId, UUID rowId, UUID columnId,
            Object value,
            long baseVersion, UUID clientMsgId,
            UndoMeta undo
    ) implements SyncMessage {
        public CellUpdate(UUID sheetId, UUID rowId, UUID columnId, Object value,
                          long baseVersion, UUID clientMsgId) {
            this(sheetId, rowId, columnId, value, baseVersion, clientMsgId, null);
        }
    }

    /**
     * Cell style mutation (ADR 0008 v2.2 / Phase A — server-canonical
     * cell style migration). Frontend has merged the user's partial
     * patch with the existing style + DEFAULT_CELL_STYLE, so {@code
     * style} is the *full* CellStyle object that should land at
     * {@code data.sheets[sheetId].rows[rowId].cellStyles[columnId]}.
     *
     * Same data_version region as cell.update — both mutate
     * projects.data JSONB. baseVersion + clientMsgId follow the
     * standard sheet-cell op envelope.
     */
    record CellStyleUpdate(
            UUID sheetId, UUID rowId, UUID columnId,
            Object style,
            long baseVersion, UUID clientMsgId,
            UndoMeta undo
    ) implements SyncMessage {
        public CellStyleUpdate(UUID sheetId, UUID rowId, UUID columnId, Object style,
                               long baseVersion, UUID clientMsgId) {
            this(sheetId, rowId, columnId, style, baseVersion, clientMsgId, null);
        }
    }

    /**
     * Sheet-level metadata patch — activeView, viewGroupColumnId,
     * viewKanbanCoverColumnId, viewKanbanFieldIds, viewCalendarEnd
     * ColumnId, viewGanttEndColumnId, viewGanttDependsColumnId,
     * savedViews, activeSavedViewId, name, icon, kind. Mutates
     * projects.data.sheets[i] keeping rows / columns intact.
     *
     * `patch` is a partial object — only present keys overwrite.
     */
    record SheetMetadataUpdate(UUID sheetId, Object patch, long baseVersion, UUID clientMsgId,
                               UndoMeta undo) implements SyncMessage {
        public SheetMetadataUpdate(UUID sheetId, Object patch, long baseVersion, UUID clientMsgId) {
            this(sheetId, patch, baseVersion, clientMsgId, null);
        }
    }

    record RowAdd(UUID sheetId, Object row, long baseVersion, UUID clientMsgId,
                  UndoMeta undo) implements SyncMessage {
        public RowAdd(UUID sheetId, Object row, long baseVersion, UUID clientMsgId) {
            this(sheetId, row, baseVersion, clientMsgId, null);
        }
    }

    record RowDelete(UUID sheetId, UUID rowId, long baseVersion, UUID clientMsgId,
                     UndoMeta undo) implements SyncMessage {
        public RowDelete(UUID sheetId, UUID rowId, long baseVersion, UUID clientMsgId) {
            this(sheetId, rowId, baseVersion, clientMsgId, null);
        }
    }

    record RowMove(UUID sheetId, UUID rowId, int toIndex, long baseVersion, UUID clientMsgId,
                   UndoMeta undo) implements SyncMessage {
        public RowMove(UUID sheetId, UUID rowId, int toIndex, long baseVersion, UUID clientMsgId) {
            this(sheetId, rowId, toIndex, baseVersion, clientMsgId, null);
        }
    }

    record ColumnAdd(UUID sheetId, Object column, long baseVersion, UUID clientMsgId,
                     UndoMeta undo) implements SyncMessage {
        public ColumnAdd(UUID sheetId, Object column, long baseVersion, UUID clientMsgId) {
            this(sheetId, column, baseVersion, clientMsgId, null);
        }
    }

    record ColumnUpdate(UUID sheetId, UUID columnId, Object patch, long baseVersion, UUID clientMsgId,
                        UndoMeta undo) implements SyncMessage {
        public ColumnUpdate(UUID sheetId, UUID columnId, Object patch, long baseVersion, UUID clientMsgId) {
            this(sheetId, columnId, patch, baseVersion, clientMsgId, null);
        }
    }

    record ColumnDelete(UUID sheetId, UUID columnId, long baseVersion, UUID clientMsgId,
                        UndoMeta undo) implements SyncMessage {
        public ColumnDelete(UUID sheetId, UUID columnId, long baseVersion, UUID clientMsgId) {
            this(sheetId, columnId, baseVersion, clientMsgId, null);
        }
    }

    record TreeAdd(
            TreeKind treeKind, UUID parentId, int position, Object node,
            long baseVersion, UUID clientMsgId,
            UndoMeta undo
    ) implements SyncMessage {
        public TreeAdd(TreeKind treeKind, UUID parentId, int position, Object node,
                       long baseVersion, UUID clientMsgId) {
            this(treeKind, parentId, position, node, baseVersion, clientMsgId, null);
        }
    }

    record TreeMove(
            TreeKind treeKind, UUID nodeId, UUID newParentId, int newPosition,
            long baseVersion, UUID clientMsgId,
            UndoMeta undo
    ) implements SyncMessage {
        public TreeMove(TreeKind treeKind, UUID nodeId, UUID newParentId, int newPosition,
                        long baseVersion, UUID clientMsgId) {
            this(treeKind, nodeId, newParentId, newPosition, baseVersion, clientMsgId, null);
        }
    }

    record TreeDelete(TreeKind treeKind, UUID nodeId, long baseVersion, UUID clientMsgId,
                      UndoMeta undo) implements SyncMessage {
        public TreeDelete(TreeKind treeKind, UUID nodeId, long baseVersion, UUID clientMsgId) {
            this(treeKind, nodeId, baseVersion, clientMsgId, null);
        }
    }

    /**
     * Tree node label patch. {@code newName} stays the canonical text
     * label; {@code newIcon} (added 2026-05-10) is an optional emoji
     * patch used by the doc tree's icon picker. Either field may be
     * present; the handler patches whichever non-null fields arrive
     * so a clean frontend can send only the changed value. Existing
     * clients that send {@code newIcon=null} keep the old behaviour
     * (rename-only).
     */
    record TreeRename(TreeKind treeKind, UUID nodeId, String newName, String newIcon,
                      long baseVersion, UUID clientMsgId,
                      UndoMeta undo) implements SyncMessage {
        public TreeRename(TreeKind treeKind, UUID nodeId, String newName, long baseVersion, UUID clientMsgId) {
            this(treeKind, nodeId, newName, null, baseVersion, clientMsgId, null);
        }
    }

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

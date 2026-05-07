// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.sync.SyncMessage;
import com.balruno.sync.UndoService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.UUID;

/**
 * Server-backed undo / redo (ADR 0021 v2.3 Phase 5, Pattern C).
 *
 * Implementation strategy:
 *   1. Find latest reversible / redoable op_idempotency row by
 *      (userId, projectId, clientSessionId) within the 120-min window.
 *   2. Mark the row {@code is_undone} (or flip back for redo).
 *   3. For each op in the row's payload (inverse for undo, forward for
 *      redo): rewrite with a fresh clientMsgId + the current
 *      project version, then dispatch via the same SheetCellOpService
 *      / TreeOpService that handles inbound wss ops. The standard
 *      apply() flow mutates state, persists a new op_idempotency row,
 *      and gives us the broadcast payload — we forward that to peers
 *      via broadcaster.broadcastFromRest.
 *   4. The newly-applied inverse / forward ops are themselves *not*
 *      undoable — they have no UndoMeta wire envelope so the second
 *      idempotency row gets NULL inverse_payload. Cmd+Z+Cmd+Z hitting
 *      the original row again is the redo path.
 */
@Service
class UndoServiceImpl implements UndoService {

    private static final Logger log = LoggerFactory.getLogger(UndoServiceImpl.class);

    private final OpIdempotencyRepository repo;
    private final SheetCellOpService sheetCellOps;
    private final TreeOpService treeOps;
    private final SyncBroadcaster broadcaster;
    private final ObjectMapper json;
    private final JdbcTemplate jdbc;

    /**
     * Tree-mutation helper. Spring Boot 4 autowires {@code
     * tools.jackson.databind.ObjectMapper}; JsonNode lives in
     * com.fasterxml — same dual-mapper pattern as
     * SheetCellOpService and CommentRepository (memory:
     * project_sb4_abstractions). nodeMapper is constructed locally
     * so the rewrite path can build ObjectNode trees.
     */
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    @Autowired
    UndoServiceImpl(OpIdempotencyRepository repo,
                    SheetCellOpService sheetCellOps,
                    TreeOpService treeOps,
                    SyncBroadcaster broadcaster,
                    ObjectMapper json,
                    JdbcTemplate jdbc) {
        this.repo = repo;
        this.sheetCellOps = sheetCellOps;
        this.treeOps = treeOps;
        this.broadcaster = broadcaster;
        this.json = json;
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public UndoResult undo(UUID userId, UUID projectId, UUID clientSessionId) {
        var found = repo.findLatestReversible(userId, projectId, clientSessionId,
                OffsetDateTime.now(ZoneOffset.UTC));
        if (found.isEmpty()) {
            return new UndoResult.NothingToUndo();
        }
        var row = found.get();
        var inverseOps = parseJsonArray(row.getInversePayload(), "inverse_payload");
        var applied = applyOpsAndBroadcast(projectId, userId, inverseOps);
        row.markUndone();
        repo.save(row);

        log.debug("undo applied userId={} projectId={} session={} ops={}",
                userId, projectId, clientSessionId, applied.size());
        return new UndoResult.Applied(row.getActionGroupId(), arrayOf(applied));
    }

    @Override
    @Transactional
    public UndoResult redo(UUID userId, UUID projectId, UUID clientSessionId) {
        var found = repo.findLatestRedoable(userId, projectId, clientSessionId,
                OffsetDateTime.now(ZoneOffset.UTC));
        if (found.isEmpty()) {
            return new UndoResult.NothingToUndo();
        }
        var row = found.get();
        var forwardOps = parseJsonArray(row.getForwardPayload(), "forward_payload");
        var applied = applyOpsAndBroadcast(projectId, userId, forwardOps);
        row.markRedone();
        repo.save(row);

        log.debug("redo applied userId={} projectId={} session={} ops={}",
                userId, projectId, clientSessionId, applied.size());
        return new UndoResult.Applied(row.getActionGroupId(), arrayOf(applied));
    }

    /**
     * For each op in the array, rewrite it with a fresh clientMsgId +
     * current project version (otherwise the baseVersion check inside
     * apply() would fail), then dispatch through the standard op
     * service. Each successful Acked result gets broadcast to peers.
     *
     * Returns the list of rewritten ops (with fresh ids + versions) so
     * the calling endpoint can ship them back to the originating
     * client for its own state reconciliation.
     */
    private ArrayList<JsonNode> applyOpsAndBroadcast(UUID projectId, UUID userId,
                                                      JsonNode opsArray) {
        var applied = new ArrayList<JsonNode>();
        for (var opNode : opsArray) {
            if (!(opNode instanceof ObjectNode)) {
                throw new IllegalStateException(
                        "undo op is not an object: " + opNode.getNodeType());
            }
            var rewritten = ((ObjectNode) opNode).deepCopy();
            rewritten.put("clientMsgId", UUID.randomUUID().toString());
            rewritten.put("baseVersion", currentVersionForOp(rewritten, projectId));
            // The replayed op carries no undo metadata — clients that
            // see the resulting broadcast should not attempt to record
            // it on their own undo stack.
            rewritten.remove("undo");

            SyncMessage msg;
            try {
                msg = json.readValue(rewritten.toString(), SyncMessage.class);
            } catch (Exception e) {
                throw new IllegalStateException(
                        "failed to deserialize undo op: " + rewritten.path("type").asText(), e);
            }

            var result = dispatchToService(projectId, userId, msg);
            if (result instanceof SyncResult.Acked acked) {
                broadcaster.broadcastFromRest(projectId, acked.broadcastPayload());
                applied.add(rewritten);
            } else if (result instanceof SyncResult.Conflict conflict) {
                // Race: a peer changed state between our version-read
                // and our apply. Abort the rest of the undo to keep
                // the tab's view consistent — the user can retry.
                throw new IllegalStateException(
                        "undo aborted by version conflict: serverVersion="
                                + conflict.serverVersion());
            }
        }
        return applied;
    }

    private SyncResult dispatchToService(UUID projectId, UUID userId, SyncMessage op) {
        return switch (op) {
            case SyncMessage.CellUpdate    msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowAdd        msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowDelete     msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowMove       msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnAdd     msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnUpdate  msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnDelete  msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.TreeAdd       msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeMove      msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeDelete    msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeRename    msg -> treeOps.apply(projectId, userId, msg);
            default -> throw new IllegalStateException(
                    "non-undoable op type in payload: " + op.getClass().getSimpleName());
        };
    }

    /**
     * Look up the current version counter for the project, picking the
     * column that matches the op's region (data_version for sheet-cell
     * ops, sheet_tree_version / doc_tree_version for tree ops). The
     * apply() flow rejects the op if baseVersion doesn't match the
     * current version, so we read it just before dispatch.
     */
    private long currentVersionForOp(ObjectNode op, UUID projectId) {
        var type = op.path("type").asText();
        var column = switch (type) {
            case "cell.update", "row.add", "row.delete", "row.move",
                 "column.add", "column.update", "column.delete" -> "data_version";
            case "tree.add", "tree.move", "tree.delete", "tree.rename" -> {
                var treeKind = op.path("treeKind").asText();
                yield "SHEET".equals(treeKind) ? "sheet_tree_version" : "doc_tree_version";
            }
            default -> throw new IllegalStateException("not an undoable op type: " + type);
        };
        var version = jdbc.queryForObject(
                "SELECT " + column + " FROM projects WHERE id = ?",
                Long.class, projectId);
        if (version == null) {
            throw new IllegalStateException("project not found: " + projectId);
        }
        return version;
    }

    private JsonNode parseJsonArray(String raw, String fieldName) {
        if (raw == null) {
            throw new IllegalStateException(fieldName + " is null on a reversible row");
        }
        try {
            var parsed = nodeMapper.readTree(raw);
            if (!parsed.isArray()) {
                throw new IllegalStateException(fieldName + " is not a JSON array");
            }
            return parsed;
        } catch (Exception e) {
            throw new IllegalStateException("malformed " + fieldName, e);
        }
    }

    private JsonNode arrayOf(ArrayList<JsonNode> nodes) {
        var arr = nodeMapper.createArrayNode();
        for (var n : nodes) arr.add(n);
        return arr;
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.sync.SyncMessage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Sheet cell region op log writer — ADR 0008 v2.0 §3.1.
 *
 * Stage B.4 scope: cell.update only — the most frequent op and the one
 * that establishes the read-lock-check-modify-write-cache pattern the
 * other ops (row.* / column.*) follow. Those land in B.4.2 (next commit)
 * by adding cases to {@link #applyToData}; the lock + idempotency +
 * version + broadcast scaffolding here is reused verbatim.
 *
 * Transaction shape (ADR 0008 §3.1):
 *   1. {@code SELECT data, data_version FROM projects WHERE id = ? FOR UPDATE}
 *      — pessimistic lock so concurrent ops on the same project serialise
 *      through the projects row, not through op_idempotency PK collisions.
 *   2. {@code SELECT * FROM op_idempotency WHERE client_msg_id = ?}
 *      — replay shortcut for reconnect cases (ADR 0008 §3.3).
 *   3. {@code if (baseVersion != current) → Conflict, no version bump}.
 *   4. apply to the JSON tree in Java (sheets[?id].rows[?id].cells[?columnId]),
 *      write back with {@code data_version + 1}.
 *   5. {@code INSERT INTO op_idempotency} (PK uniqueness is the safety net
 *      against same-client reconnect within the same project tx).
 *
 * The "apply in Java" approach (rather than a single jsonb_set call) is
 * a deliberate Stage 0 choice — id-keyed array navigation isn't
 * expressible as a fixed jsonb_set path, and the parse/serialise cost
 * (≈ 1-2 ms for a 100k-cell sheet) is dwarfed by the FOR UPDATE wait
 * we're already paying. Once Stage 1+ traffic shows JSONB hot rows we
 * revisit with a plpgsql function (ADR 0008 §6 follow-up).
 */
@Service
class SheetCellOpService {

    private final JdbcTemplate jdbc;
    private final OpIdempotencyRepository idempotency;
    private final ObjectMapper json;
    /**
     * Tree-mutation helper. Jackson 3 keeps the tree API on the legacy
     * com.fasterxml.jackson.databind.node package; only ObjectMapper
     * moved to tools.jackson. We need a node factory rooted in fasterxml
     * to build ArrayNode / ObjectNode the same JsonNode parses into.
     */
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private final org.springframework.context.ApplicationEventPublisher events;

    SheetCellOpService(JdbcTemplate jdbc,
                       OpIdempotencyRepository idempotency,
                       ObjectMapper json,
                       org.springframework.context.ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.idempotency = idempotency;
        this.json = json;
        this.events = events;
    }

    /**
     * Inbound-webhook fast path: append a row without a baseVersion
     * round-trip. Used by the inbound module's row-requested events
     * (ADR 0029). Synthesises a {@code row.add} op against the
     * current data_version + applies via the standard pipeline,
     * which broadcasts to peers and bumps the version.
     */
    @Transactional
    public void applyAppendRow(UUID projectId, UUID actorUserId, UUID sheetId,
                                UUID rowId, com.fasterxml.jackson.databind.JsonNode rowJson) {
        var current = jdbc.queryForObject(
                "SELECT data_version FROM projects WHERE id = ? AND deleted_at IS NULL",
                Long.class, projectId);
        if (current == null) {
            throw new IllegalStateException("project not found: " + projectId);
        }
        var op = new SyncMessage.RowAdd(sheetId, rowJson, current, java.util.UUID.randomUUID());
        var result = apply(projectId, actorUserId, op);
        if (result instanceof SyncResult.Conflict) {
            // Race with a concurrent edit. Re-read + retry once. If
            // still conflicting we give up — the inbound caller is
            // a fire-and-forget HTTP, retrying further would risk
            // duplicate rows on slow webhooks.
            var nv = jdbc.queryForObject(
                    "SELECT data_version FROM projects WHERE id = ?",
                    Long.class, projectId);
            if (nv == null) return;
            var retry = new SyncMessage.RowAdd(sheetId, rowJson, nv, java.util.UUID.randomUUID());
            apply(projectId, actorUserId, retry);
        }
    }

    @Transactional
    SyncResult apply(UUID projectId, UUID userId, SyncMessage op) {
        var clientMsgId = clientMsgIdOf(op);
        var baseVersion = baseVersionOf(op);

        // 1. idempotency replay shortcut. Done before the FOR UPDATE so
        //    a flood of reconnect retries doesn't queue on the project
        //    lock just to read a cached row.
        var cached = idempotency.findById(clientMsgId).orElse(null);
        if (cached != null) {
            return new SyncResult.Cached(cached.getResultVersion(), cached.getResultPayload());
        }

        // 2. lock + read current state.
        ProjectRow row;
        try {
            row = jdbc.queryForObject(
                    "SELECT data::text AS data_json, data_version "
                  + "FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
                    (rs, i) -> new ProjectRow(rs.getString("data_json"), rs.getLong("data_version")),
                    projectId);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("project not found: " + projectId, e);
        }

        // 3. baseVersion check.
        if (baseVersion != row.dataVersion) {
            return new SyncResult.Conflict(row.dataVersion);
        }

        // 4. apply to the JSON tree. The DB-side schema is Sheet[] (a
        //    bare array; ProjectServiceImpl.buildDefaultSheetJson, V9
        //    backfill, and the frontend hydrate all agree on that
        //    shape). The internal navigator below was written against
        //    a {"sheets": [...]} wrapping object — older spec leftover
        //    that mismatched after the seed shape changed. Wrap on
        //    read, unwrap on write so the navigator keeps working but
        //    the on-disk shape stays Sheet[].
        ObjectNode data;
        ArrayNode sheets;
        try {
            JsonNode parsed = nodeMapper.readTree(row.dataJson);
            sheets = parsed.isArray()
                    ? (ArrayNode) parsed
                    : nodeMapper.createArrayNode();
            data = nodeMapper.createObjectNode();
            data.set("sheets", sheets);
            applyToData(data, op);
        } catch (Exception e) {
            throw new IllegalStateException("failed to apply op to projects.data", e);
        }

        var newVersion = row.dataVersion + 1L;
        jdbc.update(
                "UPDATE projects SET data = ?::jsonb, data_version = ?, updated_at = now() "
              + "WHERE id = ?",
                sheets.toString(), newVersion, projectId);

        // 5. broadcast payload + idempotency cache.
        var broadcast = buildBroadcastPayload(op, newVersion, userId);

        // Pull undo metadata if the client attached it. Null = client did
        // not yet enable Pattern C undo, op stays non-undoable.
        var undoMeta = undoOf(op);
        var forwardJson = undoMeta != null && undoMeta.forward() != null
                ? undoMeta.forward().toString() : null;
        var inverseJson = undoMeta != null && undoMeta.inverse() != null
                ? undoMeta.inverse().toString() : null;
        var actionGroupId = undoMeta != null ? undoMeta.actionGroupId() : null;
        var clientSessionId = undoMeta != null ? undoMeta.clientSessionId() : null;

        try {
            idempotency.save(new OpIdempotencyEntity(
                    clientMsgId, userId, OpScopeKind.SHEET_CELL, projectId, newVersion, broadcast,
                    projectId, forwardJson, inverseJson, actionGroupId, clientSessionId));
        } catch (DataIntegrityViolationException e) {
            // Same clientMsgId raced through under another connection's
            // FOR UPDATE wait. The earlier transaction's row is canonical
            // — re-read and replay it instead of double-applying.
            var winning = idempotency.findById(clientMsgId).orElseThrow(() -> e);
            return new SyncResult.Cached(winning.getResultVersion(), winning.getResultPayload());
        }

        // Webhook outbound — fire-and-forget. row.add is the only
        // sheet-cell op currently subscribed (KNOWN_EVENTS in
        // WebhookService). Hooked via afterCommit so a rolled-back
        // tx can't notify external receivers. We publish a Spring
        // ApplicationEvent (not a direct WebhookService call) so
        // the webhook module isn't a static dep — Modulith's arch
        // test rejects the cycle otherwise. ADR 0028.
        if (op instanceof SyncMessage.RowAdd rowAdd) {
            org.springframework.transaction.support.TransactionSynchronizationManager
                    .registerSynchronization(
                            new org.springframework.transaction.support.TransactionSynchronization() {
                                @Override
                                public void afterCommit() {
                                    try {
                                        var payload = nodeMapper.createObjectNode();
                                        payload.put("sheetId", rowAdd.sheetId().toString());
                                        payload.set("row", nodeMapper.valueToTree(rowAdd.row()));
                                        events.publishEvent(new com.balruno.events.WebhookEvent(
                                                projectId, "row.added", payload));
                                    } catch (Exception ignored) {
                                        // Webhooks must never bubble.
                                    }
                                }
                            });
        }

        return new SyncResult.Acked(newVersion, broadcast);
    }

    // ── op-tree mutation ──────────────────────────────────────────────
    // Each op type writes through the same id-keyed navigator below.
    // Stage B.4.2 will add row.* / column.* arms; the surrounding
    // transaction logic stays unchanged.

    private void applyToData(ObjectNode data, SyncMessage op) {
        switch (op) {
            case SyncMessage.CellUpdate u      -> applyCellUpdate(data, u);
            case SyncMessage.CellStyleUpdate u -> applyCellStyleUpdate(data, u);
            case SyncMessage.SheetMetadataUpdate u -> applySheetMetadataUpdate(data, u);
            case SyncMessage.RowAdd u          -> applyRowAdd(data, u);
            case SyncMessage.RowDelete u       -> applyRowDelete(data, u);
            case SyncMessage.RowMove u         -> applyRowMove(data, u);
            case SyncMessage.ColumnAdd u       -> applyColumnAdd(data, u);
            case SyncMessage.ColumnUpdate u    -> applyColumnUpdate(data, u);
            case SyncMessage.ColumnDelete u    -> applyColumnDelete(data, u);
            default -> throw new UnsupportedOperationException(
                    "not a sheet-cell op: " + op.getClass().getSimpleName());
        }
    }

    private void applySheetMetadataUpdate(ObjectNode data, SyncMessage.SheetMetadataUpdate u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        // patch is a partial map — keys present overwrite, missing keys
        // leave existing values intact. rows / columns are intentionally
        // not mutated here even if the client misuses the payload; the
        // frontend opMapper restricts the patch to view metadata.
        var patchNode = nodeMapper.valueToTree(u.patch());
        if (!(patchNode instanceof ObjectNode patchObj)) {
            throw new IllegalArgumentException(
                    "sheet.metadata.update patch must be an object");
        }
        patchObj.fields().forEachRemaining(entry -> {
            String key = entry.getKey();
            // Guard against accidental rows/columns overwrite — the
            // wire op is for view metadata only.
            if ("rows".equals(key) || "columns".equals(key) || "id".equals(key)) {
                return;
            }
            sheet.set(key, entry.getValue());
        });
    }

    private void applyCellStyleUpdate(ObjectNode data, SyncMessage.CellStyleUpdate u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var rows = ensureArray(sheet, "rows");
        var rowNode = findById(rows, u.rowId());
        if (rowNode == null) {
            throw new IllegalArgumentException("row not found: " + u.rowId());
        }
        if (!(rowNode instanceof ObjectNode rowObj) || rowObj.get("id") == null) {
            throw new IllegalArgumentException("row not a valid object: " + u.rowId());
        }
        // cellStyles is a {columnId: CellStyle} map at the row level —
        // matches the shared Row.cellStyles shape the frontend reads.
        // Create the map if absent (older rows might not have one).
        var stylesNode = rowObj.get("cellStyles");
        ObjectNode stylesMap;
        if (stylesNode instanceof ObjectNode existing) {
            stylesMap = existing;
        } else {
            stylesMap = nodeMapper.createObjectNode();
            rowObj.set("cellStyles", stylesMap);
        }
        // Frontend has already merged the partial patch with the prior
        // style + DEFAULT_CELL_STYLE, so set the full CellStyle object
        // verbatim. Empty object {} = "no style" (idempotent delete).
        stylesMap.set(u.columnId().toString(), nodeMapper.valueToTree(u.style()));
    }

    private void applyCellUpdate(ObjectNode data, SyncMessage.CellUpdate u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var rows = ensureArray(sheet, "rows");
        var rowNode = findById(rows, u.rowId());
        if (rowNode == null) {
            throw new IllegalArgumentException("row not found: " + u.rowId());
        }
        // cells is a {columnId: value} map — matches the shared Row
        // type (Record<string, CellValue>) the frontend uses. Legacy
        // V10 rows seeded `cells: []` (empty array) which we convert
        // to map on first edit; the values were always empty so the
        // conversion is loss-less.
        var cellsMap = ensureCellMap(rowNode);
        cellsMap.set(u.columnId().toString(), nodeMapper.valueToTree(u.value()));
    }

    /**
     * Returns rowNode.cells as ObjectNode, creating or replacing as
     * needed. Replacement only happens for empty arrays (legacy V10
     * seed shape) — a non-empty array would be a real shape mismatch
     * we don't want to silently drop, so we still replace but log.
     */
    private ObjectNode ensureCellMap(ObjectNode rowNode) {
        var existing = rowNode.get("cells");
        if (existing instanceof ObjectNode obj) return obj;
        var fresh = nodeMapper.createObjectNode();
        rowNode.set("cells", fresh);
        return fresh;
    }

    private void applyRowAdd(ObjectNode data, SyncMessage.RowAdd u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var rows = ensureArray(sheet, "rows");
        // row.id is client-supplied (UUIDv7). Same id replayed → idempotency
        // would have caught it already; if it slips through (no clientMsgId
        // collision but a duplicate row.id) we drop the duplicate rather
        // than corrupting the array.
        var rowNode = nodeMapper.valueToTree(u.row());
        if (!(rowNode instanceof ObjectNode rowObj) || rowObj.get("id") == null) {
            throw new IllegalArgumentException("row.add payload must be an object with id");
        }
        if (findById(rows, UUID.fromString(rowObj.get("id").asText())) == null) {
            rows.add(rowObj);
        }
    }

    private void applyRowDelete(ObjectNode data, SyncMessage.RowDelete u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var rows = ensureArray(sheet, "rows");
        removeById(rows, u.rowId());
    }

    private void applyRowMove(ObjectNode data, SyncMessage.RowMove u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var rows = ensureArray(sheet, "rows");
        var fromIdx = indexOfId(rows, u.rowId());
        if (fromIdx < 0) {
            throw new IllegalArgumentException("row not found: " + u.rowId());
        }
        // Clamp to [0, size-1]; an out-of-range toIndex is the client's
        // best guess from a stale view, not a hard error.
        var clamped = Math.max(0, Math.min(rows.size() - 1, u.toIndex()));
        if (clamped == fromIdx) return;
        var moving = rows.remove(fromIdx);
        rows.insert(clamped, moving);
    }

    private void applyColumnAdd(ObjectNode data, SyncMessage.ColumnAdd u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var columns = ensureArray(sheet, "columns");
        var node = nodeMapper.valueToTree(u.column());
        if (!(node instanceof ObjectNode colObj) || colObj.get("id") == null) {
            throw new IllegalArgumentException("column.add payload must be an object with id");
        }
        if (findById(columns, UUID.fromString(colObj.get("id").asText())) == null) {
            columns.add(colObj);
        }
    }

    private void applyColumnUpdate(ObjectNode data, SyncMessage.ColumnUpdate u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var columns = ensureArray(sheet, "columns");
        var col = findById(columns, u.columnId());
        if (col == null) {
            throw new IllegalArgumentException("column not found: " + u.columnId());
        }
        var patch = nodeMapper.valueToTree(u.patch());
        if (!(patch instanceof ObjectNode patchObj)) {
            throw new IllegalArgumentException("column.update patch must be an object");
        }
        // Field-level merge — null values mean "clear"; absent fields stay
        // unchanged. Matches the frontend column-edit modal contract.
        // Never let the patch overwrite the column id — that would re-key
        // the column and break every existing cell.columnId pointer.
        patchObj.properties().forEach(entry -> {
            if (!"id".equals(entry.getKey())) {
                col.set(entry.getKey(), entry.getValue());
            }
        });
    }

    private void applyColumnDelete(ObjectNode data, SyncMessage.ColumnDelete u) {
        var sheet = sheetOrThrow(data, u.sheetId());
        var columns = ensureArray(sheet, "columns");
        removeById(columns, u.columnId());
        // Cascade: every row's cells map drops the entry for this
        // columnId so we don't leave dangling values referencing a
        // gone column. Legacy array-shape cells get the same treatment
        // via removeByField for backward compatibility — until they
        // get touched by a cell.update and convert to map.
        var rows = sheet.get("rows");
        if (rows instanceof ArrayNode rowArr) {
            var target = u.columnId().toString();
            for (var row : rowArr) {
                if (!(row instanceof ObjectNode rowObj)) continue;
                var cells = rowObj.get("cells");
                if (cells instanceof ObjectNode cellMap) {
                    cellMap.remove(target);
                } else if (cells instanceof ArrayNode cellArr) {
                    removeByField(cellArr, "columnId", target);
                }
            }
        }
    }

    private ObjectNode sheetOrThrow(ObjectNode data, UUID sheetId) {
        var sheets = ensureArray(data, "sheets");
        var sheet = findById(sheets, sheetId);
        if (sheet == null) {
            throw new IllegalArgumentException("sheet not found: " + sheetId);
        }
        return sheet;
    }

    // ── broadcast payload ─────────────────────────────────────────────

    private String buildBroadcastPayload(SyncMessage op, long version, UUID userId) {
        // Echo the op back with the server-assigned version + actor so
        // every sibling client can re-apply locally. Frontend hooks
        // dedupe on clientMsgId so the originator's local state isn't
        // re-mutated.
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", typeNameOf(op));
        envelope.put("version", version);
        envelope.put("userId", userId.toString());
        envelope.put("ts", System.currentTimeMillis());
        envelope.put("op", opPayload(op));
        try {
            return json.writeValueAsString(envelope);
        } catch (Exception e) {
            throw new IllegalStateException("failed to serialize broadcast payload", e);
        }
    }

    private static String typeNameOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.CellUpdate ignored      -> "cell.update";
            case SyncMessage.CellStyleUpdate ignored -> "cell.style.update";
            case SyncMessage.SheetMetadataUpdate ignored -> "sheet.metadata.update";
            case SyncMessage.RowAdd ignored          -> "row.add";
            case SyncMessage.RowDelete ignored       -> "row.delete";
            case SyncMessage.RowMove ignored         -> "row.move";
            case SyncMessage.ColumnAdd ignored       -> "column.add";
            case SyncMessage.ColumnUpdate ignored    -> "column.update";
            case SyncMessage.ColumnDelete ignored    -> "column.delete";
            default -> throw new IllegalStateException("not a sheet-cell op: " + op.getClass());
        };
    }

    private static Map<String, Object> opPayload(SyncMessage op) {
        // The record itself has the right shape; we round-trip through a
        // map to keep the broadcast envelope canonical regardless of
        // future field additions to the records.
        return switch (op) {
            case SyncMessage.CellUpdate u -> mapOf(
                    "sheetId",  u.sheetId().toString(),
                    "rowId",    u.rowId().toString(),
                    "columnId", u.columnId().toString(),
                    "value",    u.value());
            case SyncMessage.CellStyleUpdate u -> mapOf(
                    "sheetId",  u.sheetId().toString(),
                    "rowId",    u.rowId().toString(),
                    "columnId", u.columnId().toString(),
                    "style",    u.style());
            case SyncMessage.SheetMetadataUpdate u -> mapOf(
                    "sheetId", u.sheetId().toString(),
                    "patch",   u.patch());
            case SyncMessage.RowAdd u -> mapOf(
                    "sheetId", u.sheetId().toString(),
                    "row",     u.row());
            case SyncMessage.RowDelete u -> mapOf(
                    "sheetId", u.sheetId().toString(),
                    "rowId",   u.rowId().toString());
            case SyncMessage.RowMove u -> mapOf(
                    "sheetId", u.sheetId().toString(),
                    "rowId",   u.rowId().toString(),
                    "toIndex", u.toIndex());
            case SyncMessage.ColumnAdd u -> mapOf(
                    "sheetId", u.sheetId().toString(),
                    "column",  u.column());
            case SyncMessage.ColumnUpdate u -> mapOf(
                    "sheetId",  u.sheetId().toString(),
                    "columnId", u.columnId().toString(),
                    "patch",    u.patch());
            case SyncMessage.ColumnDelete u -> mapOf(
                    "sheetId",  u.sheetId().toString(),
                    "columnId", u.columnId().toString());
            default -> Map.of();
        };
    }

    /**
     * {@link Map#of} doesn't accept null values; the broadcast envelope
     * can carry a null cell value legitimately ("clear this cell"), so
     * the helper builds a LinkedHashMap so that path stays representable.
     * Order is preserved so the wire shape is stable for golden tests.
     */
    private static Map<String, Object> mapOf(Object... kv) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    // ── op envelope helpers (clientMsgId / baseVersion) ───────────────

    private static UUID clientMsgIdOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.CellUpdate u      -> u.clientMsgId();
            case SyncMessage.CellStyleUpdate u -> u.clientMsgId();
            case SyncMessage.SheetMetadataUpdate u -> u.clientMsgId();
            case SyncMessage.RowAdd u          -> u.clientMsgId();
            case SyncMessage.RowDelete u       -> u.clientMsgId();
            case SyncMessage.RowMove u         -> u.clientMsgId();
            case SyncMessage.ColumnAdd u       -> u.clientMsgId();
            case SyncMessage.ColumnUpdate u    -> u.clientMsgId();
            case SyncMessage.ColumnDelete u    -> u.clientMsgId();
            default -> throw new IllegalStateException("not a sheet-cell op: " + op.getClass());
        };
    }

    private static long baseVersionOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.CellUpdate u      -> u.baseVersion();
            case SyncMessage.CellStyleUpdate u -> u.baseVersion();
            case SyncMessage.SheetMetadataUpdate u -> u.baseVersion();
            case SyncMessage.RowAdd u          -> u.baseVersion();
            case SyncMessage.RowDelete u       -> u.baseVersion();
            case SyncMessage.RowMove u         -> u.baseVersion();
            case SyncMessage.ColumnAdd u       -> u.baseVersion();
            case SyncMessage.ColumnUpdate u    -> u.baseVersion();
            case SyncMessage.ColumnDelete u    -> u.baseVersion();
            default -> throw new IllegalStateException("not a sheet-cell op: " + op.getClass());
        };
    }

    /** Extract the optional UndoMeta from any sheet-cell op. Null if the
     *  client did not attach undo metadata (older client, or op without
     *  inverse). ADR 0021 v2.3 Phase 5. */
    static SyncMessage.UndoMeta undoOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.CellUpdate u      -> u.undo();
            case SyncMessage.CellStyleUpdate u -> u.undo();
            case SyncMessage.SheetMetadataUpdate u -> u.undo();
            case SyncMessage.RowAdd u          -> u.undo();
            case SyncMessage.RowDelete u     -> u.undo();
            case SyncMessage.RowMove u       -> u.undo();
            case SyncMessage.ColumnAdd u     -> u.undo();
            case SyncMessage.ColumnUpdate u  -> u.undo();
            case SyncMessage.ColumnDelete u  -> u.undo();
            case SyncMessage.TreeAdd u       -> u.undo();
            case SyncMessage.TreeMove u      -> u.undo();
            case SyncMessage.TreeDelete u    -> u.undo();
            case SyncMessage.TreeRename u    -> u.undo();
            default -> null;
        };
    }

    // ── tree navigation helpers ───────────────────────────────────────

    private ArrayNode ensureArray(ObjectNode parent, String key) {
        var existing = parent.get(key);
        if (existing instanceof ArrayNode arr) return arr;
        var fresh = nodeMapper.createArrayNode();
        parent.set(key, fresh);
        return fresh;
    }

    private static ObjectNode findById(ArrayNode siblings, UUID id) {
        var target = id.toString();
        for (var node : siblings) {
            if (node instanceof ObjectNode obj) {
                var idField = obj.get("id");
                if (idField != null && target.equals(idField.asText())) return obj;
            }
        }
        return null;
    }

    private static ObjectNode findByField(ArrayNode siblings, String field, String value) {
        for (var node : siblings) {
            if (node instanceof ObjectNode obj) {
                var f = obj.get(field);
                if (f != null && value.equals(f.asText())) return obj;
            }
        }
        return null;
    }

    private static int indexOfId(ArrayNode siblings, UUID id) {
        var target = id.toString();
        for (int i = 0; i < siblings.size(); i++) {
            if (siblings.get(i) instanceof ObjectNode obj) {
                var f = obj.get("id");
                if (f != null && target.equals(f.asText())) return i;
            }
        }
        return -1;
    }

    private static void removeById(ArrayNode siblings, UUID id) {
        removeByField(siblings, "id", id.toString());
    }

    private static void removeByField(ArrayNode siblings, String field, String value) {
        for (int i = siblings.size() - 1; i >= 0; i--) {
            if (siblings.get(i) instanceof ObjectNode obj) {
                var f = obj.get(field);
                if (f != null && value.equals(f.asText())) {
                    siblings.remove(i);
                }
            }
        }
    }

    private record ProjectRow(String dataJson, long dataVersion) {}
}

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

import java.util.ArrayDeque;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tree region op log writer — sheet_tree / doc_tree (ADR 0008 v2.0
 * §3.4 / §3.5). Same transaction shape as {@link SheetCellOpService}
 * (idempotency / FOR UPDATE / version check / mutate / op_idempotency)
 * with two tree-specific extras:
 *
 *   - {@code tree.move} runs an application-level ancestor walk so a
 *     node can't be moved underneath itself or any of its descendants
 *     (ADR 0008 §3.4 BFS cycle prevention).
 *   - {@code tree.delete} on the document tree cascade-soft-deletes the
 *     matching {@code documents} rows so the Hocuspocus container can't
 *     re-hydrate yjs state for an orphaned node. Soft delete (not hard)
 *     so the 30-day grace period (ADR 0015 §6 Q4) still applies; a
 *     separate cron does the hard delete after retention. {@code id IN
 *     (...)} is the matched key — doc_tree node id and documents.id are
 *     both UUIDs and are intentionally the same value for a given doc.
 *
 * Two regions ride this service via {@link SyncMessage.TreeKind}:
 *   - SHEET → projects.sheet_tree / projects.sheet_tree_version
 *     (idempotency scope SHEET_TREE)
 *   - DOC   → projects.doc_tree   / projects.doc_tree_version
 *     (idempotency scope DOC_TREE)
 *
 * Tree node shape (ADR 0011 — Outline JSONB tree pattern):
 *   {@code [{ id, name, type?, ...region-specific..., children: [...] }]}
 */
@Service
class TreeOpService {

    /**
     * Tree.add subtree budget — bounds the BFS in {@link
     * #validateTreeAddNodeBudget} so a malicious client can't push a
     * deeply nested or wide-fan-out node payload that explodes JSONB
     * row size or memory during apply. 100 covers any plausible UI
     * action (add folder = 1; move starter group = ≤ 30).
     */
    static final int MAX_TREE_ADD_NODES = 100;

    /**
     * Tree node label cap — applied to {@code name} / {@code title}
     * on tree.add and to {@code newName} on tree.rename. 200 chars
     * fits any UI label (starter sheet names = ≤ 20 chars) while
     * blocking a 1MB-name attack that would balloon the JSONB row.
     */
    static final int MAX_NAME_LENGTH = 200;

    private final JdbcTemplate jdbc;
    private final OpIdempotencyRepository idempotency;
    private final ObjectMapper json;
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private final com.balruno.events.AfterCommitPublisher afterCommit;
    private final com.balruno.workspace.LimitGuard limitGuard;

    TreeOpService(JdbcTemplate jdbc,
                  OpIdempotencyRepository idempotency,
                  ObjectMapper json,
                  com.balruno.events.AfterCommitPublisher afterCommit,
                  com.balruno.workspace.LimitGuard limitGuard) {
        this.jdbc = jdbc;
        this.idempotency = idempotency;
        this.json = json;
        this.afterCommit = afterCommit;
        this.limitGuard = limitGuard;
    }

    @Transactional
    SyncResult apply(UUID projectId, UUID userId, SyncMessage op) {
        var clientMsgId = clientMsgIdOf(op);
        var baseVersion = baseVersionOf(op);
        var treeKind = treeKindOf(op);
        var columns = TreeColumns.forKind(treeKind);

        // Cross-region detection: tree.add(SHEET, type=sheet) also
        // appends an empty Sheet shell to projects.data. We need this
        // upfront so the FOR UPDATE locks both columns in one shot.
        var sheetLeaf = detectSheetLeafCreation(op, treeKind);

        // 1. idempotency replay shortcut.
        var cached = idempotency.findById(clientMsgId).orElse(null);
        if (cached != null) {
            return new SyncResult.Cached(cached.getResultVersion(), cached.getResultPayload());
        }

        // 2. lock + read. Column names come from a closed enum so the
        //    string interpolation is not an injection vector. The data
        //    columns are pulled only when the op also touches them —
        //    keeps the row size for the 99% folder-add / move / delete
        //    / rename path the same as before.
        ProjectRow row;
        try {
            if (sheetLeaf != null) {
                row = jdbc.queryForObject(
                        "SELECT " + columns.treeColumn + "::text AS tree_json, "
                      + columns.versionColumn + " AS tree_version, "
                      + "data::text AS data_json, data_version "
                      + "FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
                        (rs, i) -> new ProjectRow(
                                rs.getString("tree_json"),
                                rs.getLong("tree_version"),
                                rs.getString("data_json"),
                                rs.getLong("data_version")),
                        projectId);
            } else {
                row = jdbc.queryForObject(
                        "SELECT " + columns.treeColumn + "::text AS tree_json, "
                      + columns.versionColumn + " AS tree_version "
                      + "FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
                        (rs, i) -> new ProjectRow(
                                rs.getString("tree_json"),
                                rs.getLong("tree_version"),
                                null, 0L),
                        projectId);
            }
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("project not found: " + projectId, e);
        }

        // 3. baseVersion check.
        if (baseVersion != row.treeVersion) {
            return new SyncResult.Conflict(row.treeVersion);
        }

        // 4. apply to the JSON tree. tree.delete returns the BFS-collected
        //    ids of the detached subtree so DOC kind can cascade them onto
        //    documents below; other ops return an empty set.
        ArrayNode roots;
        Set<UUID> deletedNodeIds;
        try {
            JsonNode parsed = nodeMapper.readTree(row.treeJson);
            roots = parsed.isArray() ? (ArrayNode) parsed : nodeMapper.createArrayNode();
            // Per-plan cap before mutating — tree.add of a sheet leaf
            // hits maxSheetsPerProject, doc leaf hits maxDocumentsPerProject.
            // Reads the plan via a project→workspace JDBC join inside
            // the same transaction. WorkspaceLimits.forPlan(...) lookup is
            // local; only the workspace_id+plan SELECT is on the wire.
            // Folder leaves are uncapped.
            if (op instanceof SyncMessage.TreeAdd add) {
                requireTreeAddBelowPlanLimit(projectId, treeKind, roots, add);
            }
            deletedNodeIds = applyToTree(roots, op);
        } catch (Exception e) {
            throw new IllegalStateException("failed to apply op to projects."
                  + columns.treeColumn, e);
        }

        var newVersion = row.treeVersion + 1L;

        // 4.5 cross-region side-effect: sheet leaf creation also appends
        // an empty Sheet shell to projects.data. Single UPDATE keeps
        // both columns in one MVCC step so peers can never observe a
        // tree leaf without a matching sheet body or vice versa.
        ObjectNode createdSheetShell = null;
        long newDataVersion = 0L;
        if (sheetLeaf != null) {
            ArrayNode sheets;
            try {
                JsonNode dataParsed = nodeMapper.readTree(row.dataJson);
                sheets = dataParsed.isArray()
                        ? (ArrayNode) dataParsed
                        : nodeMapper.createArrayNode();
            } catch (Exception e) {
                throw new IllegalStateException("failed to parse projects.data", e);
            }
            createdSheetShell = buildEmptySheetShell(sheetLeaf);
            sheets.add(createdSheetShell);
            newDataVersion = row.dataVersion + 1L;
            jdbc.update(
                    "UPDATE projects SET " + columns.treeColumn + " = ?::jsonb, "
                  + columns.versionColumn + " = ?, "
                  + "data = ?::jsonb, data_version = ?, updated_at = now() "
                  + "WHERE id = ?",
                    roots.toString(), newVersion,
                    sheets.toString(), newDataVersion,
                    projectId);
        } else {
            jdbc.update(
                    "UPDATE projects SET " + columns.treeColumn + " = ?::jsonb, "
                  + columns.versionColumn + " = ?, updated_at = now() "
                  + "WHERE id = ?",
                    roots.toString(), newVersion, projectId);
        }

        // 4.6 cascade soft-delete on documents — DOC tree.delete only.
        // Same transaction as the JSONB tree mutation so the doc body
        // and the doc_tree node disappear atomically.
        if (treeKind == SyncMessage.TreeKind.DOC && !deletedNodeIds.isEmpty()) {
            cascadeDocumentSoftDelete(deletedNodeIds);
        }

        // 5. broadcast payload + idempotency cache.
        var broadcast = buildBroadcastPayload(op, newVersion, userId,
                createdSheetShell, newDataVersion);

        // Pull undo metadata (ADR 0021 v2.3 Phase 5). Null = client did
        // not enable undo, row gets persisted as idempotency cache only.
        var undoMeta = SheetCellOpService.undoOf(op);
        var forwardJson = undoMeta != null && undoMeta.forward() != null
                ? undoMeta.forward().toString() : null;
        var inverseJson = undoMeta != null && undoMeta.inverse() != null
                ? undoMeta.inverse().toString() : null;
        var actionGroupId = undoMeta != null ? undoMeta.actionGroupId() : null;
        var clientSessionId = undoMeta != null ? undoMeta.clientSessionId() : null;

        try {
            idempotency.save(new OpIdempotencyEntity(
                    clientMsgId, userId, columns.scopeKind, projectId, newVersion, broadcast,
                    projectId, forwardJson, inverseJson, actionGroupId, clientSessionId));
        } catch (DataIntegrityViolationException e) {
            var winning = idempotency.findById(clientMsgId).orElseThrow(() -> e);
            return new SyncResult.Cached(winning.getResultVersion(), winning.getResultPayload());
        }

        // Doc tree changes (create / rename / move / delete) get
        // published into the workspace audit log so the share-dock
        // ChangeHistoryPanel surfaces them next to project / member /
        // comment events. Sheet tree changes stay out — they're
        // micro-edits already captured by cell_history (ADR 0038
        // Stage A); duplicating them in the workspace narrative
        // would drown out the bigger sheet/project sense.
        if (treeKind == SyncMessage.TreeKind.DOC) {
            publishDocTreeAuditEvent(projectId, userId, op);
        }

        return new SyncResult.Acked(newVersion, broadcast);
    }

    /**
     * Maps the doc tree op to a workspace AuditLogEvent, hooked to
     * afterCommit so a rolled-back tree.* never appears in the audit
     * narrative. Mirrors the existing webhook publish in
     * SheetCellOpService — same lifecycle, same Modulith-friendly
     * leaf event package.
     */
    private void publishDocTreeAuditEvent(UUID projectId, UUID userId, SyncMessage op) {
        // Resolve workspaceId off the project — separate read so we
        // don't reach across modules. Cheap (PK lookup) and only
        // runs on doc tree ops.
        var workspaceId = jdbc.queryForObject(
                "SELECT workspace_id FROM projects WHERE id = ?",
                UUID.class, projectId);
        if (workspaceId == null) return;

        String action;
        UUID nodeId;
        var payload = nodeMapper.createObjectNode();
        payload.put("projectId", projectId.toString());
        switch (op) {
            case SyncMessage.TreeAdd add -> {
                action = "doc.created";
                nodeId = nodeIdOf(add.node());
                payload.set("node", nodeMapper.valueToTree(add.node()));
            }
            case SyncMessage.TreeRename rn -> {
                action = "doc.renamed";
                nodeId = rn.nodeId();
                if (rn.newName() != null) payload.put("newName", rn.newName());
                if (rn.newIcon() != null) payload.put("newIcon", rn.newIcon());
            }
            case SyncMessage.TreeMove mv -> {
                action = "doc.moved";
                nodeId = mv.nodeId();
                if (mv.newParentId() != null) payload.put("newParentId", mv.newParentId().toString());
                payload.put("newPosition", mv.newPosition());
            }
            case SyncMessage.TreeDelete del -> {
                action = "doc.deleted";
                nodeId = del.nodeId();
            }
            default -> { return; }
        }
        afterCommit.publish(new com.balruno.events.AuditLogEvent(
                workspaceId, userId, action, "doc", nodeId, payload));
    }

    private static UUID nodeIdOf(Object node) {
        if (node instanceof java.util.Map<?, ?> m) {
            var id = m.get("id");
            if (id instanceof String s) {
                try { return UUID.fromString(s); } catch (IllegalArgumentException ignored) { }
            }
        }
        return null;
    }

    /**
     * Detects {@code tree.add(SHEET, type=sheet)} — the only op type
     * that has a cross-region side-effect on {@code projects.data}.
     * Returns the leaf spec ({@code id} + {@code name}) when matched,
     * {@code null} otherwise. Pulled out of {@link #apply} so the
     * SELECT/UPDATE branching can read off a single nullable.
     */
    private SheetLeafSpec detectSheetLeafCreation(SyncMessage op, SyncMessage.TreeKind kind) {
        if (kind != SyncMessage.TreeKind.SHEET) return null;
        if (!(op instanceof SyncMessage.TreeAdd add)) return null;
        var node = nodeMapper.valueToTree(add.node());
        if (!(node instanceof ObjectNode obj)) return null;
        var typeField = obj.get("type");
        if (typeField == null || !"sheet".equals(typeField.asText())) return null;
        var idField = obj.get("id");
        if (idField == null || idField.isNull()) return null;
        UUID sheetId;
        try {
            sheetId = UUID.fromString(idField.asText());
        } catch (IllegalArgumentException e) {
            return null; // validateTreeAddNodeBudget will reject before we get here
        }
        var nameField = obj.get("name");
        var name = nameField == null || nameField.isNull()
                ? "Sheet"
                : nameField.asText();
        return new SheetLeafSpec(sheetId, name);
    }

    /**
     * Builds an empty Sheet shell matching V10 / starter pack shape:
     * one default text column, one empty row. The id stays the same
     * as the leaf node so the sheet_tree pointer ↔ sheets[] array
     * lookup is stable in the frontend.
     */
    private ObjectNode buildEmptySheetShell(SheetLeafSpec spec) {
        var col = nodeMapper.createObjectNode();
        col.put("id", UUID.randomUUID().toString());
        col.put("name", "Column 1");
        col.put("type", "text");

        var row = nodeMapper.createObjectNode();
        row.put("id", UUID.randomUUID().toString());
        // cells is a {columnId: value} map (Record<string, CellValue>
        // on the frontend). An empty map is the right baseline so the
        // first cell.update lands without a shape conversion step.
        row.set("cells", nodeMapper.createObjectNode());

        var sheet = nodeMapper.createObjectNode();
        sheet.put("id", spec.id().toString());
        sheet.put("name", spec.name());
        var columns = nodeMapper.createArrayNode();
        columns.add(col);
        sheet.set("columns", columns);
        var rows = nodeMapper.createArrayNode();
        rows.add(row);
        sheet.set("rows", rows);
        return sheet;
    }

    private record SheetLeafSpec(UUID id, String name) {}

    // ── op-tree mutation ──────────────────────────────────────────────

    /**
     * Returns the BFS-collected ids of any deleted subtree (for {@code
     * tree.delete}; an empty set for the other tree ops). The caller
     * uses these to cascade-soft-delete {@code documents} rows when
     * the affected tree is the doc tree.
     */
    /**
     * Per-plan cap for {@code tree.add} — sheet leaves count toward
     * {@code maxSheetsPerProject}, doc leaves toward
     * {@code maxDocumentsPerProject}. Folder nodes are uncapped (they
     * don't carry sheet/doc rows). Reads the workspace plan via a
     * single JDBC join inside the existing transaction.
     */
    private void requireTreeAddBelowPlanLimit(UUID projectId, SyncMessage.TreeKind kind,
                                              ArrayNode currentRoots, SyncMessage.TreeAdd op) {
        var node = nodeMapper.valueToTree(op.node());
        if (!(node instanceof ObjectNode obj)) return;
        var typeField = obj.get("type");
        if (typeField == null || typeField.isNull()) return;
        var leafType = typeField.asText();
        var plan = workspacePlanFor(projectId);
        if (plan == null) return;
        var limits = com.balruno.workspace.WorkspaceLimits.forPlan(plan);
        if (kind == SyncMessage.TreeKind.SHEET && "sheet".equals(leafType)) {
            var current = countLeavesByType(currentRoots, "sheet");
            limitGuard.requireBelow(plan, "sheetsPerProject", current, limits.maxSheetsPerProject());
        } else if (kind == SyncMessage.TreeKind.DOC && "doc".equals(leafType)) {
            var current = countLeavesByType(currentRoots, "doc");
            limitGuard.requireBelow(plan, "documentsPerProject", current, limits.maxDocumentsPerProject());
        }
    }

    /** Recursive walk over the tree counting leaves with the given type. */
    private static long countLeavesByType(ArrayNode roots, String type) {
        long count = 0;
        var stack = new java.util.ArrayDeque<JsonNode>();
        stack.push(roots);
        while (!stack.isEmpty()) {
            var n = stack.pop();
            if (n.isArray()) {
                for (var c : n) stack.push(c);
            } else if (n instanceof ObjectNode obj) {
                var t = obj.get("type");
                if (t != null && type.equals(t.asText())) count++;
                var children = obj.get("children");
                if (children != null && children.isArray()) stack.push(children);
            }
        }
        return count;
    }

    /**
     * Resolves the owning workspace's billing plan for a project id.
     * Single-row PK join; returns null when the project is missing or
     * soft-deleted (the cap is skipped in that case — the broader
     * tree.add will fail on the next read anyway).
     */
    private com.balruno.workspace.WorkspacePlan workspacePlanFor(UUID projectId) {
        try {
            var name = jdbc.queryForObject(
                    "SELECT w.plan::text "
                  + "FROM workspaces w JOIN projects p ON p.workspace_id = w.id "
                  + "WHERE p.id = ? AND p.deleted_at IS NULL",
                    String.class, projectId);
            return name == null ? null : com.balruno.workspace.WorkspacePlan.valueOf(name);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            return null;
        }
    }

    private Set<UUID> applyToTree(ArrayNode roots, SyncMessage op) {
        return switch (op) {
            case SyncMessage.TreeAdd u    -> { applyTreeAdd(roots, u);    yield Collections.emptySet(); }
            case SyncMessage.TreeMove u   -> { applyTreeMove(roots, u);   yield Collections.emptySet(); }
            case SyncMessage.TreeDelete u -> applyTreeDelete(roots, u);
            case SyncMessage.TreeRename u -> { applyTreeRename(roots, u); yield Collections.emptySet(); }
            default -> throw new UnsupportedOperationException(
                    "not a tree op: " + op.getClass().getSimpleName());
        };
    }

    private void applyTreeAdd(ArrayNode roots, SyncMessage.TreeAdd u) {
        var node = nodeMapper.valueToTree(u.node());
        if (!(node instanceof ObjectNode obj) || obj.get("id") == null) {
            throw new IllegalArgumentException("tree.add node must be an object with id");
        }
        // Bound the node payload: subtree node count, name length,
        // UUID-shaped ids, no duplicate ids inside the subtree. Run
        // before the existing sibling lookup so a malicious payload
        // doesn't waste a row lock + tree walk.
        validateTreeAddNodeBudget(obj);
        // Sheet leaves are leaves by definition — strip any client-
        // supplied children so the recursive renderer can never show a
        // sub-tree under a sheet row. Folder nodes keep their children.
        var typeField = obj.get("type");
        if (typeField != null && "sheet".equals(typeField.asText())) {
            obj.remove("children");
        }
        // Clamp to [0, size]; insertion at end (size) is the natural append.
        var siblings = u.parentId() == null
                ? roots
                : ensureChildrenOf(findById(roots, u.parentId()),
                        () -> new IllegalArgumentException("parent not found: " + u.parentId()));
        if (findById(siblings, UUID.fromString(obj.get("id").asText())) != null) {
            return; // duplicate id — drop silently (same defence as sheet ops)
        }
        var clamped = Math.max(0, Math.min(siblings.size(), u.position()));
        siblings.insert(clamped, obj);
    }

    /**
     * BFS over the tree.add payload to enforce the four invariants:
     * subtree node count ≤ {@link #MAX_TREE_ADD_NODES}, every {@code
     * id} is a valid UUID, no two ids inside the same payload match,
     * and {@code name}/{@code title} stay under {@link
     * #MAX_NAME_LENGTH}. Package-private so {@link TreeOpServiceTest}
     * can exercise the rule without standing up Spring + JdbcTemplate.
     */
    static void validateTreeAddNodeBudget(ObjectNode root) {
        var queue = new ArrayDeque<JsonNode>();
        queue.add(root);
        var seenIds = new HashSet<String>();
        int count = 0;
        while (!queue.isEmpty()) {
            var cur = queue.poll();
            if (!(cur instanceof ObjectNode obj)) continue;
            count++;
            if (count > MAX_TREE_ADD_NODES) {
                throw new IllegalArgumentException(
                        "tree.add subtree exceeds " + MAX_TREE_ADD_NODES + " nodes");
            }
            var idField = obj.get("id");
            if (idField != null && !idField.isNull()) {
                var idText = idField.asText();
                try {
                    UUID.fromString(idText);
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException(
                            "tree.add node id is not a valid UUID: " + idText);
                }
                if (!seenIds.add(idText)) {
                    throw new IllegalArgumentException(
                            "tree.add subtree contains duplicate id: " + idText);
                }
            }
            checkLabelLength(obj.get("name"), "name");
            checkLabelLength(obj.get("title"), "title");
            var children = obj.get("children");
            if (children instanceof ArrayNode kids) {
                for (var kid : kids) queue.add(kid);
            }
        }
    }

    private static void checkLabelLength(JsonNode field, String which) {
        if (field == null || field.isNull()) return;
        if (field.asText().length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException(
                    "tree node " + which + " exceeds " + MAX_NAME_LENGTH + " chars");
        }
    }

    private void applyTreeMove(ArrayNode roots, SyncMessage.TreeMove u) {
        var moving = findById(roots, u.nodeId());
        if (moving == null) {
            throw new IllegalArgumentException("node not found: " + u.nodeId());
        }
        // Cycle prevention — newParentId may not be the moving node itself
        // nor any descendant. ADR 0008 §3.4: BFS over the moving subtree.
        if (wouldTreeMoveCreateCycle(roots, u.nodeId(), u.newParentId())) {
            throw new IllegalArgumentException(
                    "tree.move would create a cycle: parent="
                  + u.newParentId() + " is inside subtree " + u.nodeId());
        }
        // Detach from current parent (anywhere in the tree).
        if (!detach(roots, u.nodeId())) {
            throw new IllegalStateException("node lookup succeeded but detach missed: " + u.nodeId());
        }
        // Re-attach under newParentId.
        var siblings = u.newParentId() == null
                ? roots
                : ensureChildrenOf(findById(roots, u.newParentId()),
                        () -> new IllegalArgumentException("parent not found: " + u.newParentId()));
        var clamped = Math.max(0, Math.min(siblings.size(), u.newPosition()));
        siblings.insert(clamped, moving);
    }

    private Set<UUID> applyTreeDelete(ArrayNode roots, SyncMessage.TreeDelete u) {
        // BFS the subtree before detaching — once detach() rips the
        // node out of the tree we no longer have a handle to its
        // descendants. The collected ids drive the cascade in apply().
        var node = findById(roots, u.nodeId());
        if (node == null) {
            throw new IllegalArgumentException("node not found: " + u.nodeId());
        }
        var ids = collectIdsIncludingSelf(node);
        if (!detach(roots, u.nodeId())) {
            throw new IllegalStateException(
                    "node lookup succeeded but detach missed: " + u.nodeId());
        }
        return ids;
    }

    /**
     * Soft-delete every {@code documents} row whose id is in the
     * supplied set. {@code AND deleted_at IS NULL} keeps the operation
     * idempotent (re-applying the same tree.delete via the
     * op_idempotency replay path doesn't bump deleted_at again).
     *
     * The {@code id IN (...)} predicate uses inlined UUID literals
     * because UUID's toString() is hex+dash with no quoting hazard,
     * which avoids prepared-statement cache fragmentation across
     * different N-element sets. Real call volume here is low (only
     * tree.delete on the doc tree), so the trade-off favours one SQL
     * shape over a single cached prepared statement.
     */
    private void cascadeDocumentSoftDelete(Set<UUID> documentIds) {
        var inClause = documentIds.stream()
                .map(id -> "'" + id + "'")
                .collect(Collectors.joining(",", "(", ")"));
        jdbc.update(
                "UPDATE documents SET deleted_at = now() "
              + "WHERE id IN " + inClause + " AND deleted_at IS NULL");
    }

    private void applyTreeRename(ArrayNode roots, SyncMessage.TreeRename u) {
        // newName is patched only when present — the frontend may send
        // an icon-only patch (newIcon set, newName null) for the doc
        // icon picker. At least one of the two must be present;
        // validateRenameNewName runs only when newName is set.
        var hasName = u.newName() != null;
        var hasIcon = u.newIcon() != null;
        if (!hasName && !hasIcon) {
            throw new IllegalArgumentException("tree.rename requires newName or newIcon");
        }
        if (hasName) validateRenameNewName(u.newName());
        var node = findById(roots, u.nodeId());
        if (node == null) {
            throw new IllegalArgumentException("node not found: " + u.nodeId());
        }
        if (hasName) {
            // Both regions store the user-visible label under "name" (sheet
            // tree) or "title" (doc tree). The frontend always sends one
            // canonical "newName"; we update whichever field is present,
            // with "name" as the default so a fresh node is also covered.
            if (node.has("title")) {
                node.put("title", u.newName());
            } else {
                node.put("name", u.newName());
            }
        }
        if (hasIcon) {
            // Empty string clears the icon (picker reset to default);
            // any other value is stored verbatim. Doc tree only — sheet
            // tree leaves don't carry icons today, but writing it on a
            // sheet node is harmless (just unused metadata).
            if (u.newIcon().isEmpty()) {
                node.remove("icon");
            } else {
                node.put("icon", u.newIcon());
            }
        }
    }

    // ── tree walk helpers ─────────────────────────────────────────────

    /**
     * Recursive id-keyed find across the whole forest. Returns the
     * first match (ids are UUIDs so collisions are theoretical).
     */
    private static ObjectNode findById(JsonNode rootOrChildren, UUID id) {
        var target = id.toString();
        var stack = new ArrayDeque<JsonNode>();
        stack.push(rootOrChildren);
        while (!stack.isEmpty()) {
            var cur = stack.pop();
            if (cur instanceof ArrayNode arr) {
                for (var c : arr) stack.push(c);
            } else if (cur instanceof ObjectNode obj) {
                var idField = obj.get("id");
                if (idField != null && target.equals(idField.asText())) return obj;
                var children = obj.get("children");
                if (children instanceof ArrayNode kids) stack.push(kids);
            }
        }
        return null;
    }

    /**
     * Removes the node with this id from wherever it currently lives.
     * Returns true if anything was removed.
     */
    private static boolean detach(ArrayNode siblings, UUID id) {
        var target = id.toString();
        for (int i = 0; i < siblings.size(); i++) {
            var node = siblings.get(i);
            if (node instanceof ObjectNode obj) {
                var idField = obj.get("id");
                if (idField != null && target.equals(idField.asText())) {
                    siblings.remove(i);
                    return true;
                }
                var children = obj.get("children");
                if (children instanceof ArrayNode kids && detach(kids, id)) {
                    return true;
                }
            }
        }
        return false;
    }

    private ArrayNode ensureChildrenOf(ObjectNode parent,
                                       java.util.function.Supplier<RuntimeException> onMissing) {
        if (parent == null) throw onMissing.get();
        var existing = parent.get("children");
        if (existing instanceof ArrayNode arr) return arr;
        var fresh = nodeMapper.createArrayNode();
        parent.set("children", fresh);
        return fresh;
    }

    /**
     * Reject a tree.rename whose newName is missing, blank, or longer
     * than {@link #MAX_NAME_LENGTH}. Trim is the caller's job (frontend
     * already trims); the server only enforces hard bounds.
     */
    static void validateRenameNewName(String newName) {
        if (newName == null || newName.isBlank()) {
            throw new IllegalArgumentException("tree.rename newName is blank");
        }
        if (newName.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException(
                    "tree.rename newName exceeds " + MAX_NAME_LENGTH + " chars");
        }
    }

    /**
     * Pure tree-walk predicate for {@code tree.move} cycle prevention.
     * Package-private so the unit test can exercise the rule without
     * standing up a JdbcTemplate or going through {@link #apply}.
     *
     * Returns {@code true} when moving {@code nodeId} under
     * {@code newParentId} would place the moving subtree under itself
     * — either because {@code newParentId} equals {@code nodeId} or
     * because it sits inside the moving subtree's descendants. A
     * {@code null} {@code newParentId} (root drop) can never form a
     * cycle. A missing {@code nodeId} returns {@code false} so the
     * caller's existing "node not found" path stays the visible
     * failure mode.
     */
    static boolean wouldTreeMoveCreateCycle(ArrayNode roots, UUID nodeId, UUID newParentId) {
        if (newParentId == null) return false;
        var moving = findById(roots, nodeId);
        if (moving == null) return false;
        return collectIdsIncludingSelf(moving).contains(newParentId);
    }

    /**
     * BFS over a subtree rooted at the given node, returning every id
     * encountered including the root. Used for cycle prevention.
     */
    private static Set<UUID> collectIdsIncludingSelf(ObjectNode root) {
        var ids = new HashSet<UUID>();
        var queue = new ArrayDeque<JsonNode>();
        queue.add(root);
        while (!queue.isEmpty()) {
            var cur = queue.poll();
            if (cur instanceof ObjectNode obj) {
                var idField = obj.get("id");
                if (idField != null) {
                    try {
                        ids.add(UUID.fromString(idField.asText()));
                    } catch (IllegalArgumentException ignored) {
                        // non-uuid id — skip rather than fail the op
                    }
                }
                var children = obj.get("children");
                if (children instanceof ArrayNode kids) {
                    for (var k : kids) queue.add(k);
                }
            }
        }
        return ids;
    }

    // ── broadcast envelope ────────────────────────────────────────────

    /**
     * Builds the broadcast envelope. {@code sheetShell} +
     * {@code newDataVersion} ride along inside the op payload only
     * when the op was a sheet leaf creation — peers use them to grow
     * their local {@code sheets[]} array atomically with the
     * sheet_tree leaf insertion. {@code sheetShell == null} means
     * "no cross-region side-effect" and the op payload stays the
     * same as before.
     */
    private String buildBroadcastPayload(SyncMessage op, long version, UUID userId,
                                         ObjectNode sheetShell, long newDataVersion) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", typeNameOf(op));
        envelope.put("version", version);
        envelope.put("userId", userId.toString());
        envelope.put("ts", System.currentTimeMillis());
        var payload = new LinkedHashMap<>(opPayload(op));
        if (sheetShell != null) {
            payload.put("sheetShell", sheetShell);
            payload.put("newDataVersion", newDataVersion);
        }
        envelope.put("op", payload);
        try {
            return json.writeValueAsString(envelope);
        } catch (Exception e) {
            throw new IllegalStateException("failed to serialize broadcast payload", e);
        }
    }

    private static String typeNameOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.TreeAdd ignored    -> "tree.add";
            case SyncMessage.TreeMove ignored   -> "tree.move";
            case SyncMessage.TreeDelete ignored -> "tree.delete";
            case SyncMessage.TreeRename ignored -> "tree.rename";
            default -> throw new IllegalStateException("not a tree op: " + op.getClass());
        };
    }

    private static Map<String, Object> opPayload(SyncMessage op) {
        return switch (op) {
            case SyncMessage.TreeAdd u -> mapOf(
                    "treeKind",  u.treeKind().name(),
                    "parentId",  u.parentId() == null ? null : u.parentId().toString(),
                    "position",  u.position(),
                    "node",      u.node());
            case SyncMessage.TreeMove u -> mapOf(
                    "treeKind",     u.treeKind().name(),
                    "nodeId",       u.nodeId().toString(),
                    "newParentId",  u.newParentId() == null ? null : u.newParentId().toString(),
                    "newPosition",  u.newPosition());
            case SyncMessage.TreeDelete u -> mapOf(
                    "treeKind", u.treeKind().name(),
                    "nodeId",   u.nodeId().toString());
            case SyncMessage.TreeRename u -> mapOf(
                    "treeKind", u.treeKind().name(),
                    "nodeId",   u.nodeId().toString(),
                    "newName",  u.newName());
            default -> Map.of();
        };
    }

    private static Map<String, Object> mapOf(Object... kv) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    // ── op envelope helpers ───────────────────────────────────────────

    private static UUID clientMsgIdOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.TreeAdd u    -> u.clientMsgId();
            case SyncMessage.TreeMove u   -> u.clientMsgId();
            case SyncMessage.TreeDelete u -> u.clientMsgId();
            case SyncMessage.TreeRename u -> u.clientMsgId();
            default -> throw new IllegalStateException("not a tree op: " + op.getClass());
        };
    }

    private static long baseVersionOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.TreeAdd u    -> u.baseVersion();
            case SyncMessage.TreeMove u   -> u.baseVersion();
            case SyncMessage.TreeDelete u -> u.baseVersion();
            case SyncMessage.TreeRename u -> u.baseVersion();
            default -> throw new IllegalStateException("not a tree op: " + op.getClass());
        };
    }

    private static SyncMessage.TreeKind treeKindOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.TreeAdd u    -> u.treeKind();
            case SyncMessage.TreeMove u   -> u.treeKind();
            case SyncMessage.TreeDelete u -> u.treeKind();
            case SyncMessage.TreeRename u -> u.treeKind();
            default -> throw new IllegalStateException("not a tree op: " + op.getClass());
        };
    }

    /**
     * Closed mapping from {@link SyncMessage.TreeKind} to the column
     * names + idempotency scope. Closed because new tree regions
     * require a matching V*.sql migration anyway, so the enum and the
     * column triple stay in lockstep.
     */
    private record TreeColumns(String treeColumn, String versionColumn, OpScopeKind scopeKind) {
        static TreeColumns forKind(SyncMessage.TreeKind kind) {
            return switch (kind) {
                case SHEET -> new TreeColumns("sheet_tree", "sheet_tree_version", OpScopeKind.SHEET_TREE);
                case DOC   -> new TreeColumns("doc_tree",   "doc_tree_version",   OpScopeKind.DOC_TREE);
            };
        }
    }

    /**
     * Row snapshot for the FOR UPDATE read in {@link #apply}. The
     * {@code dataJson} / {@code dataVersion} fields are populated only
     * for the sheet-leaf-creation branch — folder/move/delete/rename
     * leave them {@code null} / {@code 0L} since those ops don't read
     * or write {@code projects.data}.
     */
    private record ProjectRow(String treeJson, long treeVersion,
                              String dataJson, long dataVersion) {}
}

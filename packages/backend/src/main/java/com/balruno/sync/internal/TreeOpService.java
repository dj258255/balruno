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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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
 *     re-hydrate yjs state for an orphaned node. The cascade SQL is a
 *     B.5 follow-up; this commit lands the tree mutation only.
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

    private final JdbcTemplate jdbc;
    private final OpIdempotencyRepository idempotency;
    private final ObjectMapper json;
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    TreeOpService(JdbcTemplate jdbc,
                  OpIdempotencyRepository idempotency,
                  ObjectMapper json) {
        this.jdbc = jdbc;
        this.idempotency = idempotency;
        this.json = json;
    }

    @Transactional
    SyncResult apply(UUID projectId, UUID userId, SyncMessage op) {
        var clientMsgId = clientMsgIdOf(op);
        var baseVersion = baseVersionOf(op);
        var treeKind = treeKindOf(op);
        var columns = TreeColumns.forKind(treeKind);

        // 1. idempotency replay shortcut.
        var cached = idempotency.findById(clientMsgId).orElse(null);
        if (cached != null) {
            return new SyncResult.Cached(cached.getResultVersion(), cached.getResultPayload());
        }

        // 2. lock + read. Column names come from a closed enum so the
        //    string interpolation is not an injection vector.
        TreeRow row;
        try {
            row = jdbc.queryForObject(
                    "SELECT " + columns.treeColumn + "::text AS tree_json, "
                  + columns.versionColumn + " AS tree_version "
                  + "FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
                    (rs, i) -> new TreeRow(rs.getString("tree_json"), rs.getLong("tree_version")),
                    projectId);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("project not found: " + projectId, e);
        }

        // 3. baseVersion check.
        if (baseVersion != row.version) {
            return new SyncResult.Conflict(row.version);
        }

        // 4. apply to the JSON tree.
        ArrayNode roots;
        try {
            JsonNode parsed = nodeMapper.readTree(row.treeJson);
            roots = parsed.isArray() ? (ArrayNode) parsed : nodeMapper.createArrayNode();
            applyToTree(roots, op);
        } catch (Exception e) {
            throw new IllegalStateException("failed to apply op to projects."
                  + columns.treeColumn, e);
        }

        var newVersion = row.version + 1L;
        jdbc.update(
                "UPDATE projects SET " + columns.treeColumn + " = ?::jsonb, "
              + columns.versionColumn + " = ?, updated_at = now() "
              + "WHERE id = ?",
                roots.toString(), newVersion, projectId);

        // 5. broadcast payload + idempotency cache.
        var broadcast = buildBroadcastPayload(op, newVersion, userId);
        try {
            idempotency.save(new OpIdempotencyEntity(
                    clientMsgId, userId, columns.scopeKind, projectId, newVersion, broadcast));
        } catch (DataIntegrityViolationException e) {
            var winning = idempotency.findById(clientMsgId).orElseThrow(() -> e);
            return new SyncResult.Cached(winning.getResultVersion(), winning.getResultPayload());
        }

        return new SyncResult.Acked(newVersion, broadcast);
    }

    // ── op-tree mutation ──────────────────────────────────────────────

    private void applyToTree(ArrayNode roots, SyncMessage op) {
        switch (op) {
            case SyncMessage.TreeAdd u    -> applyTreeAdd(roots, u);
            case SyncMessage.TreeMove u   -> applyTreeMove(roots, u);
            case SyncMessage.TreeDelete u -> applyTreeDelete(roots, u);
            case SyncMessage.TreeRename u -> applyTreeRename(roots, u);
            default -> throw new UnsupportedOperationException(
                    "not a tree op: " + op.getClass().getSimpleName());
        }
    }

    private void applyTreeAdd(ArrayNode roots, SyncMessage.TreeAdd u) {
        var node = nodeMapper.valueToTree(u.node());
        if (!(node instanceof ObjectNode obj) || obj.get("id") == null) {
            throw new IllegalArgumentException("tree.add node must be an object with id");
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

    private void applyTreeMove(ArrayNode roots, SyncMessage.TreeMove u) {
        var moving = findById(roots, u.nodeId());
        if (moving == null) {
            throw new IllegalArgumentException("node not found: " + u.nodeId());
        }
        // Cycle prevention — newParentId may not be the moving node itself
        // nor any descendant. ADR 0008 §3.4: BFS over the moving subtree.
        if (u.newParentId() != null) {
            var blocked = collectIdsIncludingSelf(moving);
            if (blocked.contains(u.newParentId())) {
                throw new IllegalArgumentException(
                        "tree.move would create a cycle: parent="
                      + u.newParentId() + " is inside subtree " + u.nodeId());
            }
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

    private void applyTreeDelete(ArrayNode roots, SyncMessage.TreeDelete u) {
        if (!detach(roots, u.nodeId())) {
            throw new IllegalArgumentException("node not found: " + u.nodeId());
        }
        // Cascade soft-delete on documents (treeKind=DOC) is a B.5
        // follow-up — the SQL needs to walk the detached subtree's ids
        // and run UPDATE documents SET deleted_at = now() WHERE id = ANY(?).
    }

    private void applyTreeRename(ArrayNode roots, SyncMessage.TreeRename u) {
        var node = findById(roots, u.nodeId());
        if (node == null) {
            throw new IllegalArgumentException("node not found: " + u.nodeId());
        }
        // Both regions store the user-visible label under "name" (sheet
        // tree) or "title" (doc tree). The frontend always sends one
        // canonical "newName"; we update whichever field is present, with
        // "name" as the default so a fresh node is also covered.
        if (node.has("title")) {
            node.put("title", u.newName());
        } else {
            node.put("name", u.newName());
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

    private String buildBroadcastPayload(SyncMessage op, long version, UUID userId) {
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

    private record TreeRow(String treeJson, long version) {}
}

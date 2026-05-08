// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.ProjectService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Project-wide search (ADR 0031). Returns hits across:
 *   * sheets — cell values + column names
 *   * sheet tree — node names (sheet group / sheet labels)
 *   * doc tree — node names
 *   * comments — body text
 *
 * Implementation: pg_trgm-indexed substring scan on each region's
 * JSONB::text, then application-side prune to extract the matching
 * sub-objects so the response stays small. Adequate up to 100k
 * cells per project; replace with tsvector + dedicated text column
 * once the search panel is hot.
 */
@RestController
@Tag(name = "Search")
@SecurityRequirement(name = "bearerAuth")
class SearchController {

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final ObjectMapper json = new ObjectMapper();

    SearchController(JdbcTemplate jdbc, ProjectService projects) {
        this.jdbc = jdbc;
        this.projects = projects;
    }

    @GetMapping(path = "/projects/{projectId}/search", version = "1")
    Map<String, Object> search(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestParam("q") String q) {
        var caller = UUID.fromString(jwt.getSubject());
        // Membership check via ProjectService.findById — non-members
        // get a 404. Same gate every project read uses.
        projects.findById(projectId, caller);

        var trimmed = q == null ? "" : q.trim();
        if (trimmed.isEmpty() || trimmed.length() < 2) {
            return Map.of("hits", List.of());
        }
        var lower = trimmed.toLowerCase();

        // Single read of the project. The pg_trgm indexes accelerate
        // the WHERE clause; we still load the full JSONB blob for
        // downstream pruning. For multi-MB projects we can switch
        // to streaming the rows but the median project is well
        // under 1 MB — load + walk in JVM is faster than two queries.
        var rows = jdbc.queryForList(
                """
                SELECT data::text AS data_text, sheet_tree::text AS st_text,
                       doc_tree::text AS dt_text
                FROM projects
                WHERE id = ? AND deleted_at IS NULL
                """,
                projectId);
        if (rows.isEmpty()) return Map.of("hits", List.of());

        var hits = new ArrayList<Map<String, Object>>();

        try {
            walkSheets(json.readTree((String) rows.get(0).get("data_text")), lower, hits);
            walkTree(json.readTree((String) rows.get(0).get("st_text")), "sheet-tree", lower, hits);
            walkTree(json.readTree((String) rows.get(0).get("dt_text")), "doc-tree", lower, hits);
        } catch (Exception ignored) {
            // Malformed JSON — return whatever hits we already accumulated.
        }

        // Comments — separate query so we can use the comments_body_text
        // index. Limited to 50 to keep the panel responsive.
        var commentRows = jdbc.queryForList(
                """
                SELECT id, project_id, scope_kind, sheet_id, row_id, document_id,
                       body_json::text AS body_text
                FROM comments
                WHERE project_id = ? AND deleted_at IS NULL
                  AND body_json::text ILIKE ?
                LIMIT 50
                """,
                projectId, "%" + trimmed + "%");
        for (var c : commentRows) {
            var snippet = extractText((String) c.get("body_text"), 200);
            var hit = new HashMap<String, Object>();
            hit.put("kind", "comment");
            hit.put("commentId", c.get("id").toString());
            hit.put("snippet", snippet);
            hit.put("scopeKind", c.get("scope_kind"));
            hit.put("sheetId", c.get("sheet_id") != null ? c.get("sheet_id").toString() : null);
            hit.put("rowId", c.get("row_id") != null ? c.get("row_id").toString() : null);
            hit.put("documentId", c.get("document_id") != null ? c.get("document_id").toString() : null);
            hits.add(hit);
        }

        return Map.of("hits", hits.size() > 200 ? hits.subList(0, 200) : hits);
    }

    private static void walkSheets(JsonNode root, String lower, List<Map<String, Object>> out) {
        if (root == null || !root.isArray()) return;
        for (var sheet : root) {
            if (!sheet.isObject()) continue;
            var sheetId = sheet.path("id").asText("");
            var sheetName = sheet.path("name").asText("");
            // Column name match
            var columns = sheet.path("columns");
            if (columns.isArray()) {
                for (var col : columns) {
                    var name = col.path("name").asText("");
                    if (name.toLowerCase().contains(lower)) {
                        var hit = new HashMap<String, Object>();
                        hit.put("kind", "column");
                        hit.put("sheetId", sheetId);
                        hit.put("sheetName", sheetName);
                        hit.put("columnId", col.path("id").asText(""));
                        hit.put("snippet", name);
                        out.add(hit);
                    }
                }
            }
            // Cell value match
            var rows = sheet.path("rows");
            if (rows.isArray()) {
                for (var row : rows) {
                    var rowId = row.path("id").asText("");
                    var cells = row.path("cells");
                    if (!cells.isObject()) continue;
                    cells.fields().forEachRemaining(entry -> {
                        var v = entry.getValue();
                        var s = v == null || v.isNull() ? "" : v.asText("");
                        if (!s.isEmpty() && s.toLowerCase().contains(lower)) {
                            var hit = new HashMap<String, Object>();
                            hit.put("kind", "cell");
                            hit.put("sheetId", sheetId);
                            hit.put("sheetName", sheetName);
                            hit.put("rowId", rowId);
                            hit.put("columnId", entry.getKey());
                            hit.put("snippet", s.length() > 200 ? s.substring(0, 199) + "…" : s);
                            out.add(hit);
                        }
                    });
                }
            }
            if (out.size() >= 200) return;
        }
    }

    private static void walkTree(JsonNode root, String kind, String lower, List<Map<String, Object>> out) {
        if (root == null || !root.isArray()) return;
        for (var node : root) {
            walkTreeNode(node, kind, lower, out);
            if (out.size() >= 200) return;
        }
    }

    private static void walkTreeNode(JsonNode node, String kind, String lower, List<Map<String, Object>> out) {
        if (node == null || !node.isObject()) return;
        var name = node.path("name").asText("");
        if (name.toLowerCase().contains(lower)) {
            var hit = new HashMap<String, Object>();
            hit.put("kind", kind);
            hit.put("nodeId", node.path("id").asText(""));
            hit.put("snippet", name);
            out.add(hit);
        }
        var children = node.path("children");
        if (children.isArray()) {
            for (var child : children) walkTreeNode(child, kind, lower, out);
        }
    }

    private static String extractText(String bodyJsonText, int max) {
        // Body is a Tiptap doc — flatten naively. Prefix collapse for
        // prettier display.
        if (bodyJsonText == null) return "";
        var s = bodyJsonText
                .replaceAll("\"type\"\\s*:\\s*\"[^\"]+\"", "")
                .replaceAll("[\\\\{}\":,\\[\\]]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return s.length() > max ? s.substring(0, max - 1) + "…" : s;
    }
}

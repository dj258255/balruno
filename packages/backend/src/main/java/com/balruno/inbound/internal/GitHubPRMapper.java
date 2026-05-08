// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound.internal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.UUID;

/**
 * Maps a GitHub webhook payload to a row record (ADR 0029).
 *
 * Supported events:
 *   - pull_request (opened, edited, closed, reopened)
 *   - issues (opened, edited, closed, reopened)
 *
 * Default column mapping when the user didn't supply one:
 *   - title  → first column whose name contains "title" or first text col
 *   - url    → first column whose name contains "url" or first url col
 *   - status → first column whose type is 'select'
 *
 * If column_mapping JSON is supplied, it overrides:
 *   { "title": "<columnId>", "url": "<columnId>", "status": "<columnId>" }
 */
final class GitHubPRMapper {

    private final ObjectMapper nodeMapper = new ObjectMapper();

    JsonNode mapToRow(String eventType, JsonNode payload, JsonNode columnMapping, UUID rowId) {
        // Extract the entity (PR or Issue) from the payload.
        JsonNode entity;
        if (payload.has("pull_request")) {
            entity = payload.get("pull_request");
        } else if (payload.has("issue")) {
            entity = payload.get("issue");
        } else {
            return null;
        }
        if (entity == null || entity.isNull()) return null;

        var title = entity.path("title").asText("(no title)");
        var url = entity.path("html_url").asText("");
        var state = entity.path("state").asText("open");
        var action = payload.path("action").asText("");
        // GitHub treats merged PRs as state=closed; the merged flag
        // disambiguates. Surface "merged" as a third state value.
        if ("pull_request".equals(eventType.split("/")[0])
                || payload.has("pull_request")) {
            if ("closed".equalsIgnoreCase(state)
                    && entity.path("merged").asBoolean(false)) {
                state = "merged";
            }
        }

        var titleCol = columnId(columnMapping, "title");
        var urlCol = columnId(columnMapping, "url");
        var statusCol = columnId(columnMapping, "status");

        var cells = nodeMapper.createObjectNode();
        if (titleCol != null) cells.put(titleCol, title);
        if (urlCol != null) cells.put(urlCol, url);
        if (statusCol != null) cells.put(statusCol, state);
        // Fall back to a sentinel if no mapping at all so the row
        // still appears in the sheet (visible diagnostic for the
        // user to fix the mapping).
        if (cells.size() == 0) {
            cells.put("__github_unmapped",
                    String.format("%s: %s (%s)", action, title, url));
        }

        ObjectNode row = nodeMapper.createObjectNode();
        row.put("id", rowId.toString());
        row.set("cells", cells);
        return row;
    }

    private static String columnId(JsonNode mapping, String key) {
        if (mapping == null || !mapping.has(key)) return null;
        var node = mapping.get(key);
        if (node == null || node.isNull()) return null;
        return node.asText(null);
    }
}

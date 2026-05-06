// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.UUID;

/**
 * Loads {@code resources/starter/catalog.json} (exported from
 * {@code packages/web/scripts/exportStarterCatalog.ts}) on startup
 * and exposes JSON serialisations of the project.data (Sheet[]) and
 * project.sheet_tree (Outline-style nested folder tree) shapes.
 *
 * The catalog has 12 starter "groups" (튜토리얼 / RPG / FPS / MOBA
 * / RTS / Idle / 덱빌더 / RPG 캐릭터 스탯 / 버그 트래커 / 플레이테스트
 * / 스프린트 보드 / 로드맵). Each group's sheets are flattened into
 * a single project.data array, and the sheet_tree gets one folder
 * per group with the group's sheets as leaf nodes (ADR 0011).
 *
 * Why pre-flatten on startup once instead of per-call: the catalog is
 * static (only changes when the export script re-runs at build time),
 * so the same JSON is served to every new signup. The flat strings
 * are cached as fields and copied verbatim into projects.data /
 * projects.sheet_tree.
 *
 * Uses fasterxml ObjectMapper rather than tools.jackson because
 * ProjectEntity stores JSONB columns as String and the surrounding
 * code (V9, V10, ProjectServiceImpl.buildDefaultSheetJson) is
 * fasterxml; keeping one library across this seam (memory:
 * project_sb4_abstractions, Jackson 3 mix trap).
 */
@Service
class StarterPackSeeder {

    private static final Logger log = LoggerFactory.getLogger(StarterPackSeeder.class);

    private final ObjectMapper json = new ObjectMapper();
    private String dataJson = "[]";
    private String sheetTreeJson = "[]";
    private int starterCount = 0;

    @PostConstruct
    void load() throws IOException {
        var resource = new ClassPathResource("starter/catalog.json");
        if (!resource.exists()) {
            log.warn("starter/catalog.json not found — onboarding will use minimal Sheet 1");
            return;
        }

        JsonNode root;
        try (var is = resource.getInputStream()) {
            root = json.readTree(is);
        }

        var starters = root.get("starters");
        if (starters == null || !starters.isArray()) {
            log.warn("starter/catalog.json malformed — expected 'starters' array");
            return;
        }

        var allSheets = json.createArrayNode();
        var treeFolders = json.createArrayNode();

        for (var starter : starters) {
            var project = starter.get("project");
            if (project == null) continue;
            var sheets = project.get("sheets");
            if (sheets == null || !sheets.isArray()) continue;

            // Flat data — every sheet from every starter ends up under
            // projects.data with its original id, so cell.update against
            // sheetId resolves regardless of which folder the sheet sits in.
            var sheetLeaves = json.createArrayNode();
            for (var sheet : sheets) {
                allSheets.add(sheet);
                if (sheet instanceof ObjectNode obj && obj.has("id") && obj.has("name")) {
                    var leaf = json.createObjectNode();
                    leaf.put("id", obj.get("id").asText());
                    leaf.put("type", "sheet");
                    leaf.put("name", obj.get("name").asText());
                    sheetLeaves.add(leaf);
                }
            }

            // One folder per starter group. The folder's id is fresh —
            // it has no analogue in the local-mode store; it's purely
            // the navigation node in sheet_tree.
            var folder = json.createObjectNode();
            folder.put("id", UUID.randomUUID().toString());
            folder.put("type", "folder");
            folder.put("name", project.get("name").asText());
            folder.set("children", sheetLeaves);
            treeFolders.add(folder);
        }

        this.dataJson = allSheets.toString();
        this.sheetTreeJson = treeFolders.toString();
        this.starterCount = treeFolders.size();
        log.info("starter pack loaded: {} groups, {} sheets total",
                starterCount, allSheets.size());
    }

    /** Project.data — flat Sheet[] across all starter groups. */
    String dataJson() {
        return dataJson;
    }

    /** Project.sheet_tree — one folder per group, sheets as leaves. */
    String sheetTreeJson() {
        return sheetTreeJson;
    }

    /** True iff the catalog loaded with at least one group. */
    boolean isAvailable() {
        return starterCount > 0;
    }
}

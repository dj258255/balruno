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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Loads {@code resources/starter/catalog-{locale}.json} (one file
 * per language, exported by {@code packages/web/scripts/
 * exportStarterCatalog.ts}) on startup and exposes two views per
 * locale:
 *
 *   1. {@link Bundle} — the entire catalog flattened into one
 *      {@code data}+{@code sheet_tree} pair, used to seed a fresh
 *      user's default project ({@link ProjectServiceImpl#createWithStarterPack}).
 *   2. {@link List GroupSummary} / {@link Group} — per-starter views
 *      so the "Add from template" UI (ADR 0020 Stage F) can list
 *      groups for the modal and import a single group on demand.
 *
 * Lookup order on {@link #buildFor} / {@link #listGroups} /
 * {@link #buildGroup}:
 *   1. exact locale match — {@code catalog-{locale}.json}
 *   2. fallback to {@code catalog-ko.json} — the source language
 *      STARTER_CATALOG was authored in
 *   3. empty if neither exists — callers fall back to the minimal
 *      Sheet 1 seed (default project) or return 404 (Stage F UI)
 *
 * Each locale's catalog is parsed once at @PostConstruct and both
 * the merged Bundle and per-group views are cached. Per-call cost
 * is a Map lookup; the JSON strings are pre-built so callers don't
 * re-serialise.
 */
@Service
class StarterPackSeeder {

    private static final Logger log = LoggerFactory.getLogger(StarterPackSeeder.class);
    private static final String DEFAULT_LOCALE = "ko";
    private static final String[] SUPPORTED_LOCALES = {"ko", "en"};

    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, LocaleCatalog> catalogs = new HashMap<>();

    @PostConstruct
    void load() throws IOException {
        for (var locale : SUPPORTED_LOCALES) {
            var resource = new ClassPathResource("starter/catalog-" + locale + ".json");
            if (!resource.exists()) {
                log.info("starter/catalog-{}.json not present — skipping", locale);
                continue;
            }
            JsonNode root;
            try (var is = resource.getInputStream()) {
                root = json.readTree(is);
            }
            var catalog = parse(root);
            if (catalog == null) {
                log.warn("starter/catalog-{}.json malformed — expected 'starters' array", locale);
                continue;
            }
            catalogs.put(locale, catalog);
            log.info("starter pack loaded: locale={} groups={} sheets={}",
                    locale, catalog.bundle.starterCount, catalog.bundle.sheetCount);
        }
    }

    private LocaleCatalog parse(JsonNode root) {
        var starters = root.get("starters");
        if (starters == null || !starters.isArray()) return null;

        var allSheets = json.createArrayNode();
        var treeFolders = json.createArrayNode();
        var groups = new ArrayList<Group>();

        for (var starter : starters) {
            var project = starter.get("project");
            if (project == null) continue;
            var sheets = project.get("sheets");
            if (sheets == null || !sheets.isArray()) continue;

            // Per-group sheet array + matching tree folder. The tree
            // folder gets a fresh UUID per *load* — the merged Bundle
            // shares those UUIDs with the cached folders so a default-
            // seeded project's tree matches the per-group breakdown.
            // Stage F's import endpoint regenerates folder UUIDs on
            // each apply (since multiple imports of the same group
            // would otherwise collide).
            var groupSheets = json.createArrayNode();
            var sheetLeaves = json.createArrayNode();
            for (var sheet : sheets) {
                allSheets.add(sheet);
                groupSheets.add(sheet);
                if (sheet instanceof ObjectNode obj && obj.has("id") && obj.has("name")) {
                    var leaf = json.createObjectNode();
                    leaf.put("id", obj.get("id").asText());
                    leaf.put("type", "sheet");
                    leaf.put("name", obj.get("name").asText());
                    sheetLeaves.add(leaf);
                }
            }

            var folder = json.createObjectNode();
            folder.put("id", UUID.randomUUID().toString());
            folder.put("type", "folder");
            folder.put("name", project.get("name").asText());
            folder.set("children", sheetLeaves);
            treeFolders.add(folder);

            // Per-group view. Group key = starter.id (stable across
            // builds, used by the import endpoint URL). Description
            // is optional; the modal shows "" gracefully.
            var groupId = textOrNull(starter.get("id"));
            if (groupId == null) continue;
            groups.add(new Group(
                    groupId,
                    project.get("name").asText(),
                    textOrNull(project.get("description")),
                    textOrNull(starter.get("color")),
                    sheetLeaves.size(),
                    groupSheets,
                    sheetLeaves));
        }

        var bundle = new Bundle(
                allSheets.toString(),
                treeFolders.toString(),
                treeFolders.size(),
                allSheets.size());
        return new LocaleCatalog(bundle, groups);
    }

    private static String textOrNull(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    // ── default-seed view ─────────────────────────────────────────────

    /**
     * Best matching catalog for the given locale, with ko fallback.
     * Returns null when neither the requested locale nor ko is loaded —
     * caller should treat that as "starter pack not available".
     */
    Bundle buildFor(String locale) {
        var hit = forLocale(locale);
        return hit == null ? null : hit.bundle;
    }

    boolean isAvailable() {
        return !catalogs.isEmpty();
    }

    // ── per-group view (Stage F) ──────────────────────────────────────

    /**
     * Metadata for the modal — id / display name / description /
     * color / sheet count, no JSON bodies. Empty list if no catalog
     * is loaded.
     */
    List<GroupSummary> listGroups(String locale) {
        var hit = forLocale(locale);
        if (hit == null) return List.of();
        return hit.groups.stream()
                .map(g -> new GroupSummary(g.id, g.name, g.description, g.color, g.sheetCount))
                .toList();
    }

    /**
     * One group's full payload — sheets[] + the matching sheet_tree
     * folder with sheet leaves. Returns null when the locale has no
     * catalog or the group key isn't present. Caller (Stage F import
     * endpoint) clones the folder + assigns a fresh folder UUID so
     * repeated imports don't collide.
     */
    Group buildGroup(String locale, String groupId) {
        var hit = forLocale(locale);
        if (hit == null) return null;
        return hit.groups.stream()
                .filter(g -> g.id.equals(groupId))
                .findFirst()
                .orElse(null);
    }

    private LocaleCatalog forLocale(String locale) {
        var key = locale == null || locale.isBlank() ? DEFAULT_LOCALE : locale;
        var hit = catalogs.get(key);
        if (hit != null) return hit;
        return catalogs.get(DEFAULT_LOCALE);
    }

    // ── records ───────────────────────────────────────────────────────

    /** Pre-flattened seed bundle (all groups merged). */
    record Bundle(String dataJson, String sheetTreeJson, int starterCount, int sheetCount) {}

    /**
     * Modal-facing summary — no JSON, no body. Designed for a /catalog
     * GET that lists what the user can import.
     */
    record GroupSummary(String id, String name, String description, String color, int sheetCount) {}

    /**
     * Full group payload for import. {@code sheets} is an ArrayNode of
     * full Sheet objects ({@code id, name, columns, rows}). {@code
     * sheetLeaves} is the matching tree leaf list ({@code id, type:
     * 'sheet', name}) — caller wraps these under a fresh folder.
     */
    record Group(
            String id,
            String name,
            String description,
            String color,
            int sheetCount,
            ArrayNode sheets,
            ArrayNode sheetLeaves
    ) {}

    private record LocaleCatalog(Bundle bundle, List<Group> groups) {
        LocaleCatalog {
            // Defensive copy — defensive against runtime mutation of
            // the cached list. Group records are immutable; the inner
            // ArrayNode is shared but only ever read by callers.
            groups = List.copyOf(groups);
        }
    }

    /**
     * Used by tests + callers that need to know whether a locale
     * actually has a catalog (vs. relying on the silent fallback).
     */
    @SuppressWarnings("unused")
    private Map<String, LocaleCatalog> catalogsForTest() {
        return new LinkedHashMap<>(catalogs);
    }
}

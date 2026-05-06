// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Loads {@code resources/starter/catalog-{locale}.json} (one file
 * per language, exported by {@code packages/web/scripts/
 * exportStarterCatalog.ts}) on startup and exposes JSON
 * serialisations of project.data + project.sheet_tree per locale.
 *
 * Lookup order on {@link #buildFor}:
 *   1. exact locale match — {@code catalog-{locale}.json}
 *   2. fallback to {@code catalog-ko.json} — the source language
 *      STARTER_CATALOG was authored in
 *   3. empty if neither exists — {@link #isAvailable} returns false
 *      so the caller falls back to the minimal Sheet 1 seed
 *
 * Each locale's catalog is parsed once at @PostConstruct and the
 * pre-flattened (data, sheetTree) JSON strings are cached. Per-call
 * cost is a Map lookup + two String hand-offs.
 */
@Service
class StarterPackSeeder {

    private static final Logger log = LoggerFactory.getLogger(StarterPackSeeder.class);
    private static final String DEFAULT_LOCALE = "ko";
    private static final String[] SUPPORTED_LOCALES = {"ko", "en"};

    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, Bundle> bundles = new HashMap<>();

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
            var bundle = parse(root);
            if (bundle == null) {
                log.warn("starter/catalog-{}.json malformed — expected 'starters' array", locale);
                continue;
            }
            bundles.put(locale, bundle);
            log.info("starter pack loaded: locale={} groups={} sheets={}",
                    locale, bundle.starterCount, bundle.sheetCount);
        }
    }

    private Bundle parse(JsonNode root) {
        var starters = root.get("starters");
        if (starters == null || !starters.isArray()) return null;

        var allSheets = json.createArrayNode();
        var treeFolders = json.createArrayNode();

        for (var starter : starters) {
            var project = starter.get("project");
            if (project == null) continue;
            var sheets = project.get("sheets");
            if (sheets == null || !sheets.isArray()) continue;

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

            var folder = json.createObjectNode();
            folder.put("id", UUID.randomUUID().toString());
            folder.put("type", "folder");
            folder.put("name", project.get("name").asText());
            folder.set("children", sheetLeaves);
            treeFolders.add(folder);
        }

        var result = new LinkedHashMap<String, String>();
        result.put("data", allSheets.toString());
        result.put("sheetTree", treeFolders.toString());
        return new Bundle(
                result.get("data"),
                result.get("sheetTree"),
                treeFolders.size(),
                allSheets.size());
    }

    /**
     * Best matching catalog for the given locale, with ko fallback.
     * Returns null when neither the requested locale nor ko is loaded —
     * caller should treat that as "starter pack not available".
     */
    Bundle buildFor(String locale) {
        var key = locale == null || locale.isBlank() ? DEFAULT_LOCALE : locale;
        var hit = bundles.get(key);
        if (hit != null) return hit;
        return bundles.get(DEFAULT_LOCALE);
    }

    boolean isAvailable() {
        return !bundles.isEmpty();
    }

    /** Pre-flattened seed for one locale. */
    record Bundle(String dataJson, String sheetTreeJson, int starterCount, int sheetCount) {}
}

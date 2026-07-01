// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Builds the {@code sync.full} hydrate payload sent to a client right
 * after a successful WebSocket handshake — ADR 0008 v2.0 §2.2.
 *
 * Single SELECT pulls both op-log regions (data / sheet_tree) plus
 * their versions, so the client gets a snapshot whose version pair is
 * guaranteed coherent (same MVCC visibility window). Once the client
 * receives this, every subsequent op carries one of those versions as
 * {@code baseVersion} and the conflict check in
 * {@link SheetCellOpService} / {@link TreeOpService} is meaningful.
 */
@Service
class ProjectStateLoader {

    private final ProjectSyncRepository projects;
    private final ObjectMapper json;

    ProjectStateLoader(ProjectSyncRepository projects, ObjectMapper json) {
        this.projects = projects;
        this.json = json;
    }

    /** Returns the serialised {@code sync.full} envelope, ready to send. */
    @Transactional(readOnly = true)
    String loadFull(UUID projectId) {
        var row = projects.loadFullState(projectId)
                .orElseThrow(() -> new IllegalStateException("project not found: " + projectId));

        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "sync.full");
        envelope.put("data",      parse(row.getDataJson()));
        envelope.put("sheetTree", parse(row.getSheetTreeJson()));
        envelope.put("versions", Map.of(
                "data",      row.getDataVersion(),
                "sheetTree", row.getSheetTreeVersion()));
        try {
            return json.writeValueAsString(envelope);
        } catch (Exception e) {
            throw new IllegalStateException("failed to serialise sync.full envelope", e);
        }
    }

    /**
     * Parse the raw JSON column into a tree node so the surrounding
     * {@link ObjectMapper} embeds it as a nested object/array rather
     * than re-escaping it as a string. Returns an empty object/array
     * for malformed columns — schema NOT NULL DEFAULT covers fresh
     * rows, so a parse failure means a manual write tampered with the
     * blob and we'd rather hand the client a clean baseline than 500.
     */
    private Object parse(String raw) {
        if (raw == null || raw.isBlank()) return Map.of();
        try {
            // Use tools.jackson (the same ObjectMapper that
            // writeValueAsString uses below). Mixing fasterxml's
            // JsonNode with tools.jackson's writer made the writer
            // treat the foreign node as a POJO and emit
            // {array: true, bigDecimal: false, ...} (the JsonNode
            // method getters serialised as fields), which is what
            // hit the frontend's hydrate as sheetCount=0.
            return json.readTree(raw);
        } catch (Exception e) {
            return Map.of();
        }
    }
}

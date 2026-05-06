// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * Single SELECT pulls all three op-log regions (data / sheet_tree /
 * doc_tree) plus their versions, so the client gets a snapshot whose
 * version triple is guaranteed coherent (same MVCC visibility window).
 * Once the client receives this, every subsequent op carries one of
 * those versions as {@code baseVersion} and the conflict check in
 * {@link SheetCellOpService} / {@link TreeOpService} is meaningful.
 *
 * Document body (yjs) is NOT included here — that lives on the
 * separate Hocuspocus channel and hydrates lazily per-document when
 * the client opens an editor (ADR 0017 § 4-region split).
 */
@Service
class ProjectStateLoader {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    ProjectStateLoader(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** Returns the serialised {@code sync.full} envelope, ready to send. */
    @Transactional(readOnly = true)
    String loadFull(UUID projectId) {
        State row;
        try {
            row = jdbc.queryForObject(
                    "SELECT data::text AS d, data_version AS dv, "
                  + "       sheet_tree::text AS st, sheet_tree_version AS stv, "
                  + "       doc_tree::text   AS dt, doc_tree_version   AS dtv "
                  + "FROM projects WHERE id = ? AND deleted_at IS NULL",
                    (rs, i) -> new State(
                            rs.getString("d"),  rs.getLong("dv"),
                            rs.getString("st"), rs.getLong("stv"),
                            rs.getString("dt"), rs.getLong("dtv")),
                    projectId);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("project not found: " + projectId, e);
        }

        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "sync.full");
        envelope.put("data",      parse(row.dataJson));
        envelope.put("sheetTree", parse(row.sheetTreeJson));
        envelope.put("docTree",   parse(row.docTreeJson));
        envelope.put("versions", Map.of(
                "data",      row.dataVersion,
                "sheetTree", row.sheetTreeVersion,
                "docTree",   row.docTreeVersion));
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
            return nodeMapper.readTree(raw);
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private record State(
            String dataJson, long dataVersion,
            String sheetTreeJson, long sheetTreeVersion,
            String docTreeJson, long docTreeVersion
    ) {}
}

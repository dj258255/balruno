// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.HistoryEntry;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for cell_history (V26 / ADR 0038 Stage A).
 *
 * Append-only — there's no UPDATE path. Inserts come from
 * {@link HistoryEventListener} on SyncOpProcessedEvent; reads
 * come from {@link HistoryServiceImpl} via JPQL constructor
 * projections. The payload JSONB binds via @JdbcTypeCode(JSON)
 * so Hibernate 7 reads / writes JsonNode natively without the
 * manual ObjectMapper round-trip the JdbcTemplate version did.
 */
@Entity
@Table(name = "cell_history")
class HistoryEntryEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "sheet_id", nullable = false, updatable = false)
    private UUID sheetId;

    @Column(name = "row_id", updatable = false)
    private UUID rowId;

    @Column(name = "column_id", updatable = false)
    private UUID columnId;

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "action", nullable = false, updatable = false)
    private String action;

    @Column(name = "payload", columnDefinition = "jsonb", updatable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode payload;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected HistoryEntryEntity() {} // JPA

    HistoryEntryEntity(UUID projectId, UUID sheetId, UUID rowId, UUID columnId,
                       UUID actorId, String action, JsonNode payload) {
        this.projectId = projectId;
        this.sheetId = sheetId;
        this.rowId = rowId;
        this.columnId = columnId;
        this.actorId = actorId;
        this.action = action;
        this.payload = payload;
    }

    HistoryEntry toDto() {
        return new HistoryEntry(id, projectId, sheetId, rowId, columnId,
                actorId, action, payload, createdAt);
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.HistoryEntry;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Persistence for cell_history (V26 / ADR 0038 Stage A).
 *
 * Reads use JPQL constructor projections so the page-history /
 * Activity-tab list returns ready-to-serve {@link HistoryEntry}
 * DTOs without an entity-to-DTO map step at the call site.
 *
 * The cleanup path stays a native @Modifying DELETE because
 * {@code now() - make_interval(...)} is PG-specific and pairs
 * with the cell_history_created_idx range scan.
 */
interface HistoryRepository extends JpaRepository<HistoryEntryEntity, UUID> {

    @Query("""
           SELECT new com.balruno.history.HistoryEntry(
                   h.id, h.projectId, h.sheetId, h.rowId, h.columnId,
                   h.actorId, h.action, h.payload, h.createdAt)
             FROM HistoryEntryEntity h
            WHERE h.projectId = :projectId
              AND h.sheetId = :sheetId
              AND h.rowId = :rowId
              AND h.createdAt >= :cutoff
            ORDER BY h.createdAt DESC
           """)
    List<HistoryEntry> listForRow(@Param("projectId") UUID projectId,
                                  @Param("sheetId") UUID sheetId,
                                  @Param("rowId") UUID rowId,
                                  @Param("cutoff") OffsetDateTime cutoff,
                                  Limit limit);

    @Query("""
           SELECT new com.balruno.history.HistoryEntry(
                   h.id, h.projectId, h.sheetId, h.rowId, h.columnId,
                   h.actorId, h.action, h.payload, h.createdAt)
             FROM HistoryEntryEntity h
            WHERE h.projectId = :projectId
              AND h.sheetId = :sheetId
              AND h.createdAt >= :cutoff
            ORDER BY h.createdAt DESC
           """)
    List<HistoryEntry> listForSheet(@Param("projectId") UUID projectId,
                                    @Param("sheetId") UUID sheetId,
                                    @Param("cutoff") OffsetDateTime cutoff,
                                    Limit limit);

    @Modifying
    @Query(value = "DELETE FROM cell_history "
                 + " WHERE created_at < now() - make_interval(days => :days)",
           nativeQuery = true)
    int pruneOlderThan(@Param("days") int days);
}

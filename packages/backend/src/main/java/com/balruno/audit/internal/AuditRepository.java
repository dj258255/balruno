// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit.internal;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Persistence layer for the workspace audit log (ADR 0032). Append-
 * only — entries are immutable. Spring Data derived methods cover
 * the only two access paths (insert via save, list-newest-first).
 */
interface AuditRepository extends JpaRepository<AuditEntryEntity, UUID> {

    /**
     * Newest-first list, capped via {@link Limit} so callers can
     * forward an {@code int limit} from the controller without
     * worrying about ORDER BY + LIMIT translation.
     */
    List<AuditEntryEntity> findByWorkspaceIdOrderByIdDesc(UUID workspaceId, Limit limit);
}

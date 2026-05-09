// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit.internal;

import com.balruno.audit.AuditEntry;
import com.balruno.audit.AuditService;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Default {@link AuditService} implementation.
 *
 * Membership / tier auth lives in the controller — this module
 * doesn't depend on workspace or quota. The pattern matches webhook
 * outbound (ADR 0028).
 */
@Service
class AuditServiceImpl implements AuditService {

    private final AuditRepository repo;

    AuditServiceImpl(AuditRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditEntry> listForWorkspace(UUID callerUserId, UUID workspaceId, int limit) {
        var capped = Math.min(Math.max(limit, 1), 500);
        return repo.findByWorkspaceIdOrderByIdDesc(workspaceId, Limit.of(capped))
                .stream()
                .map(AuditEntryEntity::toDto)
                .toList();
    }
}

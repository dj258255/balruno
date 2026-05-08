// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit;

import java.util.List;
import java.util.UUID;

public interface AuditService {
    List<AuditEntry> listForWorkspace(UUID callerUserId, UUID workspaceId, int limit);
}

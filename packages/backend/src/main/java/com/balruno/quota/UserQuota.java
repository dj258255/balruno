// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.quota;

import java.util.List;
import java.util.UUID;

/**
 * Aggregated quota view returned by {@code GET /api/v1/me/quota} (FR-LIMIT-003).
 * Workspace creation is uncapped (Notion / Airtable / Baserow / AFFiNE
 * pattern) so this DTO carries only the per-workspace usage rows; the
 * caller's "how many workspaces do I own" headline is just
 * {@code workspaces.size()}.
 *
 * Lives in {@code com.balruno.quota} rather than {@code com.balruno.workspace}
 * so the controller can depend on both the workspace and project modules
 * without creating a {@code workspace ↔ project} slice cycle (the
 * Modulith ArchitectureTest enforces this).
 */
public record UserQuota(
        UUID userId,
        long ownedWorkspaces,
        List<WorkspaceQuotaUsage> workspaces
) {}

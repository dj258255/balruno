// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.quota;

import com.balruno.workspace.WorkspaceLimits;
import com.balruno.workspace.WorkspacePlan;

import java.util.UUID;

/**
 * Per-workspace usage snapshot inside {@link UserQuota}. Counts that
 * cross domain modules (members from workspace, projects from project,
 * documents/cells from sheet/doc when those land) are aggregated by the
 * controller; only the dimensions whose data already exists are filled
 * in today.
 */
public record WorkspaceQuotaUsage(
        UUID workspaceId,
        String slug,
        String name,
        WorkspacePlan plan,
        long memberCount,
        long projectCount,
        WorkspaceLimits limits
) {}

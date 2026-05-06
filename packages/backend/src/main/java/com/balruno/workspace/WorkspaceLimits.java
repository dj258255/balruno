// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Per-plan FREE-tier and paid-tier quota constants. Held in code (not a
 * DB row) so a quota tweak is a one-line constant change plus redeploy.
 * Operator-driven overrides (FR-LIMIT-004) will live in a separate
 * {@code quota_overrides} table when needed; the override path will
 * shadow these defaults at the {@code LimitGuard} level.
 *
 * {@code Integer.MAX_VALUE} encodes "unlimited" rather than introducing
 * a separate {@code Optional<Integer>} — the comparisons stay arithmetic
 * and the JSON over the wire stays a plain number for the frontend.
 *
 * No {@code maxOwnedWorkspacesPerUser} field: 12 of 14 surveyed SaaS
 * (Notion, Airtable, Baserow, AFFiNE, …) impose no per-user cap on
 * workspace creation, instead gating on per-workspace resources. We
 * follow that pattern — abuse is contained by the per-workspace caps
 * below, and a future anti-abuse soft cap belongs at the request layer
 * rather than as a marketed limit.
 */
public record WorkspaceLimits(
        int maxMembersPerWorkspace,
        int maxProjectsPerWorkspace,
        int maxSheetsPerProject,
        int maxRowsPerSheet,
        int maxCellsPerProject,
        int maxDocumentsPerProject,
        long maxAttachmentBytes,
        int historyRetentionDays,
        int aiRequestsPerMonth
) {

    public static final int UNLIMITED = Integer.MAX_VALUE;

    public static WorkspaceLimits forPlan(WorkspacePlan plan) {
        return switch (plan) {
            case FREE -> new WorkspaceLimits(
                    /* maxMembersPerWorkspace */    3,
                    /* maxProjectsPerWorkspace */   3,
                    /* maxSheetsPerProject */       10,
                    /* maxRowsPerSheet */           2_000,
                    /* maxCellsPerProject */        20_000,
                    /* maxDocumentsPerProject */    20,
                    /* maxAttachmentBytes */        50L * 1024 * 1024,        // 50 MB
                    /* historyRetentionDays */      14,
                    /* aiRequestsPerMonth */        0                          // BYOK only
            );
            case PRO -> new WorkspaceLimits(
                    10,
                    20,
                    50,
                    20_000,
                    200_000,
                    200,
                    5L * 1024 * 1024 * 1024,                                  // 5 GB
                    60,
                    50);
            case TEAM -> new WorkspaceLimits(
                    UNLIMITED,
                    UNLIMITED,
                    UNLIMITED,
                    100_000,
                    1_000_000,
                    UNLIMITED,
                    50L * 1024 * 1024 * 1024,                                 // 50 GB
                    180,
                    200);
        };
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import org.springframework.stereotype.Component;

/**
 * Cross-module guard helper used by service create paths to enforce the
 * per-plan quotas declared in {@link WorkspaceLimits}. The guard does no
 * counting itself — callers pass the pre-mutation count alongside the
 * plan's limit so each domain service stays responsible for its own SQL.
 *
 * Public (rather than {@code internal}) because both the workspace and
 * project modules — and future sheet / document modules — need to call
 * it. Per Spring Modulith conventions, anything in this package is part
 * of the workspace module's published surface.
 */
@Component
public class LimitGuard {

    /**
     * Throws {@link QuotaException} when {@code current >= limit}. Use the
     * pre-mutation count: callers check before inserting, not after.
     */
    public void requireBelow(WorkspacePlan plan, String quotaKey, long current, long limit) {
        if (current >= limit) {
            throw new QuotaException(
                    quotaKey, current, limit, plan,
                    "Quota exceeded for " + quotaKey
                            + " (plan=" + plan + ", current=" + current + ", limit=" + limit + ").");
        }
    }
}

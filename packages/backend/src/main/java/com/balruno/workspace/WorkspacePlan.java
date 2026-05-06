// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Pricing tier of a workspace. Per-workspace billing — a user can own
 * one FREE workspace and be a member of a TEAM workspace at the same
 * time. The limits attached to each plan live in {@link WorkspaceLimits}.
 *
 * Adding a new tier (e.g., ENTERPRISE) is a two-step migration: add the
 * value to the PG {@code workspace_plan} ENUM via {@code ALTER TYPE},
 * then extend {@link WorkspaceLimits#forPlan} — PG's ENUM allows ADD
 * VALUE but not REMOVE, so think before adding.
 */
public enum WorkspacePlan {
    FREE,
    PRO,
    TEAM
}

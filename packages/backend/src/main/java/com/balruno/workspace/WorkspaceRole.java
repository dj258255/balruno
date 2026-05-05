// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Workspace member role. Adapts Baserow's 5-tier model to our hybrid
 * (sheet + document) domain by generalising the meaning: Builder owns
 * "structural" changes (sheet schema / sheet tree / doc tree / project),
 * Editor owns "content" edits (sheet cells / doc body).
 *
 * Ordered strongest → weakest. {@code permits(target)} answers "does
 * this role carry at least the responsibilities of {@code target}?".
 *
 * The string values mirror the {@code workspace_role} PG ENUM. Adding a
 * tier requires both a Flyway ENUM ADD VALUE migration and a new
 * constant here.
 */
public enum WorkspaceRole {
    OWNER,
    ADMIN,
    BUILDER,
    EDITOR,
    VIEWER;

    /**
     * Whether this role carries at least the responsibilities of
     * {@code target}. {@code OWNER.permits(EDITOR) == true}.
     */
    public boolean permits(WorkspaceRole target) {
        return this.ordinal() <= target.ordinal();
    }
}

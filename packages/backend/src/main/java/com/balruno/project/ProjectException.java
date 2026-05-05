// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project;

/**
 * Domain-level exception for the project module. The shared
 * ApiExceptionHandler maps each {@link Reason} onto an HTTP status
 * (400 / 404 / 409).
 *
 * Workspace-level concerns (NOT_A_MEMBER, INSUFFICIENT_ROLE) are still
 * raised as WorkspaceException — project operations call
 * WorkspaceService.requireRole and let those bubble up unchanged.
 */
public class ProjectException extends RuntimeException {

    public enum Reason {
        PROJECT_NOT_FOUND,    // 404
        SLUG_TAKEN,           // 409 — another active project in the same workspace owns it
        SLUG_INVALID          // 400 — fails the regex / length rule
    }

    private final Reason reason;

    public ProjectException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}

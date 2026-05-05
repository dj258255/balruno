// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Domain-level exception for the workspace module. The shared
 * ApiExceptionHandler maps each {@link Reason} onto the right HTTP
 * status (400 / 403 / 404 / 409 / 410) — see ADR 0015 for the full
 * mapping.
 */
public class WorkspaceException extends RuntimeException {

    public enum Reason {
        SLUG_TAKEN,            // 409 — user-supplied slug already in use
        SLUG_RESERVED,         // 400 — reserved word (api / app / admin / ...)
        SLUG_INVALID,          // 400 — fails the regex / length rule
        WORKSPACE_NOT_FOUND,   // 404
        NOT_A_MEMBER,          // 403 — caller is not a member at all
        INSUFFICIENT_ROLE,     // 403 — caller's role is below the required tier
        OWNER_REQUIRED,        // 403 — Owner-only action
        CANNOT_REMOVE_OWNER,   // 409 — would remove the last Owner
        INVITE_EXPIRED,        // 410
        INVITE_ALREADY_USED,   // 409
        INVITE_REVOKED         // 410
    }

    private final Reason reason;

    public WorkspaceException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}

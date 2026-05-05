// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

/**
 * Thrown when an inbound OAuth login can't be honoured. The most common
 * cause is the verified-email auto-link refusal — see
 * {@code OAuthLinkRule.RejectUnverifiedEmail} in the user module's
 * internal package.
 *
 * The message is safe to surface to end users; it intentionally avoids
 * leaking which provider or which user owns the conflicting email.
 */
public class UserAuthException extends RuntimeException {

    public enum Reason {
        UNVERIFIED_EMAIL_CONFLICT
    }

    private final Reason reason;

    public UserAuthException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}

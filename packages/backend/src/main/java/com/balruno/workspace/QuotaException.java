// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Thrown when a create / mutation would push a quota above the plan's
 * limit. {@link com.balruno.shared.api.ApiExceptionHandler} maps this to
 * {@code 403 QUOTA_EXCEEDED} (FR-LIMIT-002) and serialises the four
 * fields below as RFC 7807 extensions so the frontend can render a
 * targeted upgrade nudge without parsing the human-readable detail.
 *
 * Why 403 (not 402 Payment Required): the user is authenticated and the
 * action is allowed in principle — they're just over their quota. 402
 * is reserved for "subscription required" once the billing surface lands.
 */
public class QuotaException extends RuntimeException {

    private final String quotaKey;
    private final long current;
    private final long limit;
    private final WorkspacePlan plan;

    public QuotaException(String quotaKey, long current, long limit,
                          WorkspacePlan plan, String message) {
        super(message);
        this.quotaKey = quotaKey;
        this.current = current;
        this.limit = limit;
        this.plan = plan;
    }

    public String quotaKey() { return quotaKey; }
    public long current() { return current; }
    public long limit() { return limit; }
    public WorkspacePlan plan() { return plan; }
}

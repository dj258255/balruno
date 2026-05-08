// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.billing;

import java.util.UUID;

/**
 * Public surface of the billing module (ADR 0004).
 *
 * Frontend hits {@link #createCheckoutSession} to mint a Stripe
 * Checkout URL the user redirects to. Stripe webhook events arrive
 * at the public {@link #handleWebhookEvent} entrypoint inside the
 * controller — verified server-side via the endpoint secret.
 */
public interface BillingService {

    /**
     * Mint a Checkout Session for the given workspace + plan.
     * Returns the redirect URL the frontend opens in a new tab /
     * the same window. Caller must be a workspace admin.
     */
    String createCheckoutSession(UUID callerUserId, UUID workspaceId, String plan,
                                  String successUrl, String cancelUrl);

    /**
     * Mint a Customer Portal session — the user manages payment
     * method / cancellation / invoices on Stripe-hosted UI.
     */
    String createPortalSession(UUID callerUserId, UUID workspaceId, String returnUrl);
}

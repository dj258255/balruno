// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.billing.internal;

import com.balruno.billing.BillingService;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.param.CustomerCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.util.UUID;

/**
 * Stripe-backed billing implementation (ADR 0004).
 *
 * Three properties drive the integration:
 *   balruno.billing.stripe.secret-key       Stripe API key (sk_live_… / sk_test_…)
 *   balruno.billing.stripe.webhook-secret   Used to verify webhook signatures (set in StripeWebhookController)
 *   balruno.billing.stripe.price.{plan}     Stripe Price IDs (price_xxx) for PRO / TEAM
 *
 * Workspace customer creation is lazy — the first checkout creates
 * a Stripe Customer, stores the id on the workspace row, and reuses
 * it for subsequent sessions.
 */
@Service
class BillingServiceImpl implements BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingServiceImpl.class);

    private final JdbcTemplate jdbc;

    @Value("${balruno.billing.stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${balruno.billing.stripe.price.pro:}")
    private String priceIdPro;

    @Value("${balruno.billing.stripe.price.team:}")
    private String priceIdTeam;

    BillingServiceImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    void init() {
        if (stripeSecretKey != null && !stripeSecretKey.isBlank()) {
            Stripe.apiKey = stripeSecretKey;
        } else {
            log.warn("Stripe secret key not configured — billing endpoints will 503.");
        }
    }

    @Override
    @Transactional
    public String createCheckoutSession(UUID callerUserId, UUID workspaceId, String plan,
                                         String successUrl, String cancelUrl) {
        ensureConfigured();
        var priceId = resolvePriceId(plan);
        var customerId = ensureCustomer(workspaceId);
        try {
            var params = com.stripe.param.checkout.SessionCreateParams.builder()
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomer(customerId)
                    .addLineItem(
                            com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                                    .setPrice(priceId)
                                    .setQuantity(1L)
                                    .build())
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .putMetadata("workspaceId", workspaceId.toString())
                    .putMetadata("plan", plan)
                    .build();
            var session = com.stripe.model.checkout.Session.create(params);
            return session.getUrl();
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe checkout session failed: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public String createPortalSession(UUID callerUserId, UUID workspaceId, String returnUrl) {
        ensureConfigured();
        var customerId = ensureCustomer(workspaceId);
        try {
            var params = com.stripe.param.billingportal.SessionCreateParams.builder()
                    .setCustomer(customerId)
                    .setReturnUrl(returnUrl)
                    .build();
            return com.stripe.model.billingportal.Session.create(params).getUrl();
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe portal session failed: " + e.getMessage(), e);
        }
    }

    private void ensureConfigured() {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            throw new IllegalStateException(
                    "Billing not configured — set balruno.billing.stripe.secret-key");
        }
    }

    private String resolvePriceId(String plan) {
        return switch (plan) {
            case "PRO" -> priceIdPro;
            case "TEAM" -> priceIdTeam;
            default -> throw new IllegalArgumentException("unsupported plan: " + plan);
        };
    }

    /** Lazy create + cache the Stripe Customer for a workspace. */
    private String ensureCustomer(UUID workspaceId) {
        var existing = jdbc.queryForList(
                "SELECT stripe_customer_id, name, slug FROM workspaces WHERE id = ?",
                workspaceId);
        if (existing.isEmpty()) {
            throw new IllegalStateException("workspace not found: " + workspaceId);
        }
        var row = existing.get(0);
        var customerId = (String) row.get("stripe_customer_id");
        if (customerId != null) return customerId;

        try {
            var customer = Customer.create(CustomerCreateParams.builder()
                    .setName((String) row.get("name"))
                    .putMetadata("workspaceId", workspaceId.toString())
                    .putMetadata("slug", (String) row.get("slug"))
                    .build());
            customerId = customer.getId();
            jdbc.update(
                    "UPDATE workspaces SET stripe_customer_id = ? WHERE id = ?",
                    customerId, workspaceId);
            return customerId;
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe customer creation failed: " + e.getMessage(), e);
        }
    }

    /** Update workspace plan + cached subscription state from a
     *  webhook event. Called by BillingWebhookController. */
    @Transactional
    void onSubscriptionChanged(String customerId, String subscriptionId, String status,
                                Long currentPeriodEnd, String plan) {
        var ts = currentPeriodEnd == null
                ? null
                : new java.sql.Timestamp(currentPeriodEnd * 1000L);
        jdbc.update(
                """
                UPDATE workspaces
                   SET stripe_subscription_id = ?,
                       stripe_subscription_status = ?,
                       stripe_current_period_end = ?,
                       plan = COALESCE(?::workspace_plan, plan)
                 WHERE stripe_customer_id = ?
                """,
                subscriptionId, status, ts, plan, customerId);
    }
}

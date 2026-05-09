// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.billing.internal;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.sql.Timestamp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

/**
 * BillingServiceImpl unit tests covering the testable surface that
 * doesn't require live Stripe APIs:
 *
 *   - configuration validation (missing secret key)
 *   - plan → Stripe price id resolution
 *   - webhook subscription-state UPDATE shape
 *
 * The Stripe-side paths (createCheckoutSession, ensureCustomer,
 * createPortalSession) call static methods on com.stripe.model.*
 * that can't be Mockito-mocked without PowerMock. Those land in
 * integration tests with stripe-mock as a Testcontainers sidecar.
 *
 * @Value-injected fields (stripeSecretKey, priceIdPro, priceIdTeam)
 * are set via ReflectionTestUtils — ApplicationContext isn't
 * available in pure unit tests.
 */
@ExtendWith(MockitoExtension.class)
class BillingServiceImplTest {

    @Mock JdbcTemplate jdbc;
    @InjectMocks BillingServiceImpl service;

    @Nested
    @DisplayName("ensureConfigured")
    class EnsureConfigured {

        @Test
        void blank_secret_key_throws_with_actionable_message() {
            // Operator sees the env var name to fix — better than a
            // cryptic Stripe SDK error a few stack frames deeper.
            ReflectionTestUtils.setField(service, "stripeSecretKey", "");
            assertThatThrownBy(() -> service.ensureConfigured())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("balruno.billing.stripe.secret-key");
        }

        @Test
        void null_secret_key_throws() {
            ReflectionTestUtils.setField(service, "stripeSecretKey", null);
            assertThatThrownBy(() -> service.ensureConfigured())
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void valid_secret_key_passes_silently() {
            ReflectionTestUtils.setField(service, "stripeSecretKey", "sk_test_abc");
            // No exception expected — method returns void on success.
            service.ensureConfigured();
        }
    }

    @Nested
    @DisplayName("resolvePriceId")
    class ResolvePriceId {

        @Test
        void PRO_returns_pro_price_id() {
            ReflectionTestUtils.setField(service, "priceIdPro", "price_pro_test");
            assertThat(service.resolvePriceId("PRO")).isEqualTo("price_pro_test");
        }

        @Test
        void TEAM_returns_team_price_id() {
            ReflectionTestUtils.setField(service, "priceIdTeam", "price_team_test");
            assertThat(service.resolvePriceId("TEAM")).isEqualTo("price_team_test");
        }

        @Test
        void FREE_or_unknown_throws_with_offending_value() {
            // FREE has no Stripe price (it's the no-card tier) — a
            // FREE checkout request is a client bug, surfaces clearly.
            assertThatThrownBy(() -> service.resolvePriceId("FREE"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("FREE");

            assertThatThrownBy(() -> service.resolvePriceId("UNKNOWN_PLAN"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("UNKNOWN_PLAN");
        }

        @Test
        void lowercase_plan_rejected_case_sensitive() {
            // Defence against a frontend bug — explicit-only acceptance
            // forces the wire payload to match the documented enum.
            assertThatThrownBy(() -> service.resolvePriceId("pro"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("onSubscriptionChanged")
    class WebhookHandler {

        @Test
        void typical_subscription_update_writes_all_columns() {
            // Webhook delivers customer + subscription ids + status +
            // current_period_end (epoch s) + plan. The UPDATE writes
            // all four into the workspace's billing columns; the COALESCE
            // on plan keeps the existing plan when null is passed.
            service.onSubscriptionChanged(
                    "cus_test", "sub_test", "active",
                    1700000000L, "PRO");

            var sqlCap = ArgumentCaptor.forClass(String.class);
            verify(jdbc).update(sqlCap.capture(),
                    eq("sub_test"), eq("active"),
                    any(Timestamp.class), eq("PRO"), eq("cus_test"));
            assertThat(sqlCap.getValue()).contains("UPDATE workspaces");
            assertThat(sqlCap.getValue()).contains("stripe_subscription_id");
            assertThat(sqlCap.getValue()).contains("stripe_subscription_status");
        }

        @Test
        void null_period_end_passes_null_timestamp() {
            // current_period_end may be absent on some webhook events
            // (e.g., subscription.deleted). Expect a null Timestamp
            // arg rather than 0 epoch.
            service.onSubscriptionChanged(
                    "cus_test", "sub_test", "canceled",
                    null, null);

            verify(jdbc).update(anyString(),
                    eq("sub_test"), eq("canceled"),
                    eq(null), eq(null), eq("cus_test"));
        }

        @Test
        void null_plan_uses_COALESCE_to_preserve_existing() {
            // Plan-less webhook events (status-only updates) must not
            // overwrite the plan to null — the SQL has COALESCE(?, plan)
            // exactly for this. The test verifies null reaches the SQL
            // (the COALESCE behaviour itself is DB-side).
            service.onSubscriptionChanged(
                    "cus_test", "sub_test", "past_due",
                    1700000000L, null);

            verify(jdbc).update(anyString(),
                    eq("sub_test"), eq("past_due"),
                    any(Timestamp.class),
                    eq(null), eq("cus_test"));
        }

        @Test
        void epoch_period_end_converts_to_timestamp_in_milliseconds() {
            // Stripe sends seconds; java.sql.Timestamp wants millis.
            // Off-by-1000 here would put the period end 30 years in
            // the past or future — guard against the regression.
            var epochSeconds = 1_700_000_000L;
            service.onSubscriptionChanged(
                    "cus_test", "sub_test", "active",
                    epochSeconds, "TEAM");

            var tsCap = ArgumentCaptor.forClass(Timestamp.class);
            verify(jdbc).update(anyString(),
                    eq("sub_test"), eq("active"),
                    tsCap.capture(), eq("TEAM"), eq("cus_test"));

            assertThat(tsCap.getValue().getTime())
                    .isEqualTo(epochSeconds * 1000L);
        }
    }
}

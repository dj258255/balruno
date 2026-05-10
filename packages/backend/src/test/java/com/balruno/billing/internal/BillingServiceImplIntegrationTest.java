// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.billing.internal;

import com.balruno.TestcontainersConfig;
import com.balruno.workspace.WorkspacePlan;
import com.stripe.Stripe;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for BillingServiceImpl against a real
 * <a href="https://github.com/stripe/stripe-mock">stripe-mock</a>
 * server running in a Testcontainer. The Stripe SDK calls
 * (Customer.create, checkout.Session.create, billingportal.Session
 * .create) hit the mock at localhost:&lt;mapped&gt; — verifying the
 * full HTTPS request shape that pure-unit tests can't (Customer.create
 * is a static call that Mockito can't intercept without PowerMock).
 *
 * The mock generates fake-but-shape-correct Stripe responses, which
 * is sufficient for verifying our request payloads are well-formed
 * and our response parsing reads the right fields.
 *
 * onSubscriptionChanged is also covered here (instead of the unit
 * test) because the SQL UPDATE needs a real workspaces table with
 * the workspace_plan ENUM type and pgcrypto / uuidv7 default.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@Testcontainers
@Import(TestcontainersConfig.class)
class BillingServiceImplIntegrationTest {

    @Container
    static GenericContainer<?> stripeMock = new GenericContainer<>(
            DockerImageName.parse("stripe/stripe-mock:latest"))
            .withExposedPorts(12111)
            .waitingFor(Wait.forListeningPort());

    @Autowired BillingServiceImpl service;
    @Autowired JdbcTemplate jdbc;

    @BeforeAll
    static void redirectStripeApiToMock() {
        // Stripe SDK reads Stripe.apiBase as the global base URL —
        // overridden once for the whole test class so SDK calls go
        // to the mock instead of api.stripe.com. The "sk_test_xxx"
        // key is a placeholder; stripe-mock accepts anything.
        Stripe.apiKey = "sk_test_integration";
        Stripe.overrideApiBase("http://" + stripeMock.getHost()
                + ":" + stripeMock.getMappedPort(12111));
    }

    @Test
    @Transactional
    void createCheckoutSession_lazy_creates_customer_then_returns_session_url() {
        // First-time checkout: workspace has no stripe_customer_id;
        // service creates a Customer at Stripe, stores the id, then
        // builds a checkout Session. The mock returns synthetic ids.
        var workspaceId = seedWorkspace();
        ReflectionTestUtils.setField(service, "stripeSecretKey", "sk_test_integration");
        ReflectionTestUtils.setField(service, "priceIdPro", "price_pro_test");

        var url = service.createCheckoutSession(
                UUID.randomUUID(), workspaceId, "PRO",
                "https://example.com/ok", "https://example.com/cancel");

        assertThat(url).isNotBlank();
        // Customer id was persisted on the workspace row.
        var customerId = jdbc.queryForObject(
                "SELECT stripe_customer_id FROM workspaces WHERE id = ?",
                String.class, workspaceId);
        assertThat(customerId).isNotBlank();
    }

    @Test
    @Transactional
    void createCheckoutSession_reuses_existing_customer() {
        // Second checkout on the same workspace shouldn't re-create
        // the Stripe Customer — reuse the cached id. We pre-set the
        // id and verify createCheckoutSession completes without
        // overwriting it.
        var workspaceId = seedWorkspace();
        var preExistingCustomer = "cus_pre_existing";
        jdbc.update("UPDATE workspaces SET stripe_customer_id = ? WHERE id = ?",
                preExistingCustomer, workspaceId);
        ReflectionTestUtils.setField(service, "stripeSecretKey", "sk_test_integration");
        ReflectionTestUtils.setField(service, "priceIdPro", "price_pro_test");

        service.createCheckoutSession(
                UUID.randomUUID(), workspaceId, "PRO",
                "https://example.com/ok", "https://example.com/cancel");

        var afterId = jdbc.queryForObject(
                "SELECT stripe_customer_id FROM workspaces WHERE id = ?",
                String.class, workspaceId);
        assertThat(afterId).isEqualTo(preExistingCustomer);
    }

    @Test
    @Transactional
    void createPortalSession_returns_url_for_existing_customer() {
        var workspaceId = seedWorkspace();
        jdbc.update("UPDATE workspaces SET stripe_customer_id = ? WHERE id = ?",
                "cus_existing", workspaceId);
        ReflectionTestUtils.setField(service, "stripeSecretKey", "sk_test_integration");

        var url = service.createPortalSession(
                UUID.randomUUID(), workspaceId, "https://example.com/return");

        assertThat(url).isNotBlank();
    }

    @Test
    @Transactional
    void onSubscriptionChanged_updates_workspace_billing_columns() {
        // Webhook arrives → service writes subscription_id / status /
        // period_end / plan onto the workspace row. The COALESCE on
        // plan keeps the existing value when null is passed.
        var workspaceId = seedWorkspace();
        var customerId = "cus_webhook";
        jdbc.update("UPDATE workspaces SET stripe_customer_id = ? WHERE id = ?",
                customerId, workspaceId);

        service.onSubscriptionChanged(
                customerId, "sub_xyz", "active",
                1700000000L, "PRO");

        var row = jdbc.queryForMap(
                "SELECT stripe_subscription_id, stripe_subscription_status, "
              + "       stripe_current_period_end, plan::text AS plan "
              + "FROM workspaces WHERE id = ?",
                workspaceId);

        assertThat(row.get("stripe_subscription_id")).isEqualTo("sub_xyz");
        assertThat(row.get("stripe_subscription_status")).isEqualTo("active");
        assertThat(row.get("stripe_current_period_end")).isNotNull();
        assertThat(row.get("plan")).isEqualTo("PRO");
    }

    @Test
    @Transactional
    void onSubscriptionChanged_with_null_plan_preserves_existing_plan() {
        // Status-only webhook (e.g., subscription.updated for
        // billing-cycle changes that don't switch plan) — null plan
        // arg must NOT overwrite the existing plan. The SQL has
        // COALESCE(?, plan) for exactly this.
        var workspaceId = seedWorkspace();
        jdbc.update("UPDATE workspaces SET plan = 'PRO'::workspace_plan, "
                  + "stripe_customer_id = ? WHERE id = ?",
                "cus_null_plan", workspaceId);

        service.onSubscriptionChanged(
                "cus_null_plan", "sub_abc", "past_due",
                1700000000L, null);

        var plan = jdbc.queryForObject(
                "SELECT plan::text FROM workspaces WHERE id = ?",
                String.class, workspaceId);
        assertThat(plan).isEqualTo("PRO"); // preserved, not nulled
    }

    @Test
    @Transactional
    void onSubscriptionChanged_with_null_period_end_writes_null_timestamp() {
        // Some webhook events (subscription.deleted) come without a
        // current_period_end. The DB column is nullable; service
        // should write NULL rather than 0-epoch.
        var workspaceId = seedWorkspace();
        jdbc.update("UPDATE workspaces SET stripe_customer_id = ? WHERE id = ?",
                "cus_null_end", workspaceId);

        service.onSubscriptionChanged(
                "cus_null_end", "sub_canceled", "canceled",
                null, null);

        var endTs = jdbc.queryForObject(
                "SELECT stripe_current_period_end FROM workspaces WHERE id = ?",
                java.sql.Timestamp.class, workspaceId);
        assertThat(endTs).isNull();
    }

    @Test
    @Transactional
    void unknown_customerId_in_webhook_is_silent_noop() {
        // Webhook for a customer we don't track (e.g., from a
        // different Stripe account / migration) — UPDATE matches
        // zero rows and the call returns. No throw, no side-effect.
        service.onSubscriptionChanged(
                "cus_unknown_to_us", "sub_x", "active",
                1700000000L, "PRO");

        // No side-effect to verify — just that the call didn't throw.
        // Implicit assertion: this line is reached.
    }

    /** Seed a workspace + owning user. */
    private UUID seedWorkspace() {
        var userId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, email_verified) "
              + "VALUES (?, ?, true)",
                userId, "u-" + userId + "@test");
        var wsId = UUID.randomUUID();
        var slug = "ws-" + wsId.toString().substring(0, 8);
        jdbc.update(
                "INSERT INTO workspaces (id, slug, name, plan, created_by) "
              + "VALUES (?, ?, ?, 'FREE'::workspace_plan, ?)",
                wsId, slug, "test", userId);
        return wsId;
    }
}

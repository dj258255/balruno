// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.billing.internal;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

/**
 * Billing-module persistence over the {@code workspaces} table.
 *
 * Owns the three Stripe-shaped writes + the read of the customer
 * lookup. Stays in billing.internal because the column set is
 * Stripe-specific and the rest of the workspaces table belongs to
 * the workspace module — no need to widen WorkspaceEntity's surface
 * for fields no other module reads.
 */
interface BillingWorkspaceRepository extends Repository<BillingWorkspaceEntity, UUID> {

    @Query(value = """
                   SELECT stripe_customer_id AS stripe_customer_id,
                          name               AS name,
                          slug               AS slug
                     FROM workspaces
                    WHERE id = :workspaceId
                   """,
           nativeQuery = true)
    Optional<CustomerLookupRow> findCustomerLookup(@Param("workspaceId") UUID workspaceId);

    interface CustomerLookupRow {
        String getStripeCustomerId();
        String getName();
        String getSlug();
    }

    @Modifying
    @Query(value = "UPDATE workspaces SET stripe_customer_id = :customerId WHERE id = :workspaceId",
           nativeQuery = true)
    int saveStripeCustomerId(@Param("workspaceId") UUID workspaceId,
                             @Param("customerId") String customerId);

    /**
     * Webhook subscription update. Plan is optional — when
     * {@code null}, the COALESCE keeps the existing column value so a
     * mid-cycle plan change isn't accidentally reset by a generic
     * {@code customer.subscription.updated} event that didn't carry a
     * new tier.
     */
    @Modifying
    @Query(value = """
                   UPDATE workspaces
                      SET stripe_subscription_id     = :subscriptionId,
                          stripe_subscription_status = :status,
                          stripe_current_period_end  = :currentPeriodEnd,
                          plan                       = COALESCE(CAST(:plan AS workspace_plan), plan)
                    WHERE stripe_customer_id = :customerId
                   """,
           nativeQuery = true)
    int updateSubscriptionState(@Param("customerId") String customerId,
                                @Param("subscriptionId") String subscriptionId,
                                @Param("status") String status,
                                @Param("currentPeriodEnd") Timestamp currentPeriodEnd,
                                @Param("plan") String plan);
}

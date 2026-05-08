-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V20 — Stripe billing (ADR 0004, 2026-05-08).
--
-- Builds on V5's workspaces.plan column (already 'FREE' default).
-- Adds the Stripe-side identifiers we need to handle Checkout
-- redirect + the customer-portal billing surface, plus a
-- subscription status mirror so we can degrade gracefully on
-- payment failure without trusting the webhook to never miss a
-- delivery.

ALTER TABLE workspaces
    ADD COLUMN stripe_customer_id TEXT,
    ADD COLUMN stripe_subscription_id TEXT,

    -- Cached subscription status — mirrors Stripe's status enum
    -- ('trialing', 'active', 'past_due', 'canceled', 'unpaid', ...).
    -- Source of truth is Stripe, but we keep a copy so reads don't
    -- have to round-trip on every limit check.
    stripe_subscription_status TEXT,

    -- When the current period ends — for the 'PRO active until 11/12'
    -- chip in the settings panel. NULL for FREE workspaces.
    stripe_current_period_end TIMESTAMPTZ;

-- Lookup by customer / subscription id is what the webhook handler
-- does on every event. Indexes keep that fast.
CREATE UNIQUE INDEX workspaces_stripe_customer_idx
    ON workspaces (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX workspaces_stripe_subscription_idx
    ON workspaces (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

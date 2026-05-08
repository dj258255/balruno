-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V17 — User notification preferences + Web Push subscriptions
--        (ADR 0024 Stage I, 2026-05-08).
--
-- Two tables, one purpose: drive who gets notified about what.
--
--   user_notification_preferences = per-user channel toggles +
--     digest cadence. Baserow's pattern: digest_frequency in
--     ('instant', 'daily', 'weekly', 'off'). 'instant' = fire as
--     event happens. 'daily' / 'weekly' = aggregate into a digest
--     email at midnight UTC. 'off' = no email at all (push only).
--
--   web_push_subscriptions = one row per (user, browser/device).
--     Carries the three values the Web Push API requires for
--     delivery: endpoint URL (browser-issued, points at FCM /
--     Mozilla Autopush / Apple Push depending on browser), p256dh
--     ECDH public key, auth secret. We sign each push with our
--     server-side VAPID private key; the browser verifies via the
--     public key it embeds in the subscription request.
--
-- Why split: prefs are 1:1 with users, subscriptions are 1:N. Joining
-- them in one table would force NULL columns for users with prefs
-- but no devices subscribed yet (the common case at signup).

-- ─── user_notification_preferences ──────────────────────────────────
CREATE TABLE user_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

    -- Email channel — fires through the SMTP provider configured in
    -- spring.mail.* (admin brings their own — Outline/AFFiNE/Baserow
    -- pattern, no built-in service).
    email_on_mention BOOLEAN NOT NULL DEFAULT true,
    email_on_comment_reply BOOLEAN NOT NULL DEFAULT true,

    -- Web Push channel — fires through the browser's native push
    -- service via VAPID. Free forever (RFC 8292), no third-party
    -- dependency beyond the browsers themselves.
    push_on_mention BOOLEAN NOT NULL DEFAULT true,
    push_on_comment_reply BOOLEAN NOT NULL DEFAULT false,

    -- Digest cadence for email. 'instant' = a separate email per
    -- event (one mention = one email). 'daily' = aggregate into one
    -- midnight UTC summary. 'weekly' = Monday midnight UTC.
    -- 'off' = email channel entirely disabled, even when the
    -- per-event toggles are true (used by users who only want push).
    digest_frequency TEXT NOT NULL DEFAULT 'instant'
        CHECK (digest_frequency IN ('instant', 'daily', 'weekly', 'off')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── web_push_subscriptions ─────────────────────────────────────────
CREATE TABLE web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- The browser-issued push endpoint URL. Points at FCM (Chrome /
    -- Edge / Brave), Mozilla Autopush (Firefox), or Apple Push
    -- (Safari). We POST our payload here; the browser pushes it to
    -- the device. TEXT (not VARCHAR) — endpoints can be 200+ chars.
    endpoint TEXT NOT NULL,

    -- ECDH public key the browser generated for this subscription.
    -- Base64url-encoded. We use it (with our VAPID private key) to
    -- ECDH-derive a per-message encryption key per RFC 8291.
    p256dh TEXT NOT NULL,

    -- Auth secret the browser generated for this subscription.
    -- Base64url-encoded 16-byte random. Mixed into the encryption
    -- key derivation so push services can't read the payload.
    auth TEXT NOT NULL,

    -- Diagnostic: which browser this subscription belongs to.
    -- Helps the user identify "which device should I revoke" in
    -- the prefs UI when they have multiple subscriptions.
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,

    -- Same user resubscribing on the same browser produces an
    -- identical endpoint — ON CONFLICT DO UPDATE on (user_id, endpoint)
    -- to refresh the keys without leaving stale rows.
    UNIQUE (user_id, endpoint)
);

CREATE INDEX web_push_subs_user_idx
    ON web_push_subscriptions (user_id);

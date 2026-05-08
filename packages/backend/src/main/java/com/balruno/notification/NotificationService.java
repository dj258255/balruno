// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification;

import java.util.List;
import java.util.UUID;

/**
 * Public surface of the notification module (ADR 0024 Stage I).
 *
 * Read / write user preferences and Web Push subscriptions. Actual
 * delivery on @mention happens inside the module via
 * {@code @EventListener} on {@code MentionCreatedEvent}.
 */
public interface NotificationService {

    /** Lazy-init: returns defaults (all-true, instant) when the user
     *  hasn't customised yet. The DB row only gets written on first
     *  update. */
    NotificationPreference getPreference(UUID userId);

    NotificationPreference updatePreference(UUID userId, UpdatePreferenceInput input);

    /** Upsert by (user_id, endpoint) — re-subscribing on the same
     *  browser refreshes the keys. */
    WebPushSubscription saveSubscription(UUID userId, SaveSubscriptionInput input);

    List<WebPushSubscription> listSubscriptions(UUID userId);

    void deleteSubscription(UUID userId, UUID subscriptionId);

    /** VAPID public key for the frontend's pushManager.subscribe call.
     *  Generated once at startup if the env var is unset; persisted
     *  to disk so the same key survives restarts. */
    String vapidPublicKey();

    record UpdatePreferenceInput(
            Boolean emailOnMention,
            Boolean emailOnCommentReply,
            Boolean pushOnMention,
            Boolean pushOnCommentReply,
            String digestFrequency
    ) {}

    record SaveSubscriptionInput(
            String endpoint,
            String p256dh,
            String auth,
            String userAgent
    ) {}
}

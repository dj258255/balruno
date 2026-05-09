// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.WebPushSubscription;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for web_push_subscriptions (V17).
 *
 * One row per (user, browser/device). The (user_id, endpoint)
 * uniqueness lets a user resubscribing on the same browser refresh
 * the keys via UPSERT instead of accumulating stale rows.
 */
@Entity
@Table(name = "web_push_subscriptions")
class WebPushSubscriptionEntity {

    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "endpoint", nullable = false, updatable = false)
    private String endpoint;

    @Column(name = "p256dh", nullable = false)
    private String p256dh;

    @Column(name = "auth", nullable = false)
    private String auth;

    @Column(name = "user_agent")
    private String userAgent;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "last_used_at")
    private OffsetDateTime lastUsedAt;

    protected WebPushSubscriptionEntity() {} // JPA

    WebPushSubscription toDto() {
        return new WebPushSubscription(
                id, userId, endpoint, p256dh, auth, userAgent,
                createdAt, lastUsedAt);
    }
}

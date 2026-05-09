// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Persistence for web_push_subscriptions (V17).
 *
 * Resubscribing on the same browser produces an identical endpoint;
 * upsert on (user_id, endpoint) refreshes the keys without leaving
 * stale rows. touchLastUsed runs on every push delivery → native
 * @Modifying to skip dirty-check overhead.
 */
interface WebPushSubscriptionRepository extends JpaRepository<WebPushSubscriptionEntity, UUID> {

    List<WebPushSubscriptionEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query(value = """
                   INSERT INTO web_push_subscriptions (
                       user_id, endpoint, p256dh, auth, user_agent)
                   VALUES (:userId, :endpoint, :p256dh, :auth, :userAgent)
                   ON CONFLICT (user_id, endpoint) DO UPDATE SET
                       p256dh = EXCLUDED.p256dh,
                       auth = EXCLUDED.auth,
                       user_agent = EXCLUDED.user_agent
                   """,
           nativeQuery = true)
    int upsert(@Param("userId") UUID userId,
               @Param("endpoint") String endpoint,
               @Param("p256dh") String p256dh,
               @Param("auth") String auth,
               @Param("userAgent") String userAgent);

    /** Re-fetch helper after upsert — returns the row uniquely keyed by
     *  (user_id, endpoint). */
    java.util.Optional<WebPushSubscriptionEntity> findByUserIdAndEndpoint(UUID userId, String endpoint);

    @Modifying
    @Query(value = "DELETE FROM web_push_subscriptions WHERE id = :id AND user_id = :userId",
           nativeQuery = true)
    int deleteByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    @Modifying
    @Query(value = "DELETE FROM web_push_subscriptions WHERE endpoint = :endpoint",
           nativeQuery = true)
    int deleteByEndpoint(@Param("endpoint") String endpoint);

    @Modifying
    @Query(value = "UPDATE web_push_subscriptions SET last_used_at = :now WHERE id = :id",
           nativeQuery = true)
    int touchLastUsed(@Param("id") UUID id, @Param("now") OffsetDateTime now);
}

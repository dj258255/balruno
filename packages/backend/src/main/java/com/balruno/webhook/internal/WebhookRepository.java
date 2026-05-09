// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Persistence for webhooks (ADR 0028).
 *
 * The active-subscribers lookup uses the Postgres-specific
 * {@code = ANY(events)} predicate against the TEXT[] column.
 * JPQL has no portable form for that, so it stays a native
 * @Query — and the filter pairs naturally with the partial
 * index {@code webhooks_project_active_idx WHERE active = true}.
 *
 * setActive + recordAttempt are single-row UPDATEs on the
 * outbound dispatcher's hot path; native @Modifying skips
 * the entity-load + dirty-check round-trip.
 */
interface WebhookRepository extends JpaRepository<WebhookEntity, UUID> {

    List<WebhookEntity> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    @Query(value = """
                   SELECT * FROM webhooks
                    WHERE project_id = :projectId
                      AND active = true
                      AND :event = ANY(events)
                   """,
           nativeQuery = true)
    List<WebhookEntity> findActiveSubscribers(@Param("projectId") UUID projectId,
                                              @Param("event") String event);

    @Modifying
    @Query(value = "UPDATE webhooks SET active = :active WHERE id = :id",
           nativeQuery = true)
    int setActive(@Param("id") UUID id, @Param("active") boolean active);

    @Modifying
    @Query(value = """
                   UPDATE webhooks
                      SET last_attempt_at = :now,
                          last_status_code = :statusCode,
                          last_error = :error
                    WHERE id = :id
                   """,
           nativeQuery = true)
    int recordAttempt(@Param("id") UUID id,
                      @Param("now") OffsetDateTime now,
                      @Param("statusCode") Integer statusCode,
                      @Param("error") String error);
}

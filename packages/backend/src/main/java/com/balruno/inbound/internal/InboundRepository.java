// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Persistence for inbound_webhooks (ADR 0029).
 *
 * recordReceive is the diagnostic UPDATE path — single-row,
 * three columns, called once per webhook delivery. Native
 * @Modifying skips the entity-load + dirty-check that
 * JpaRepository.save() would do, which matters because this
 * runs on the hot inbound path.
 */
interface InboundRepository extends JpaRepository<InboundWebhookEntity, UUID> {

    List<InboundWebhookEntity> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    @Modifying
    @Query(value = "UPDATE inbound_webhooks "
                 + "   SET last_received_at = :now, last_status = :status, last_error = :error "
                 + " WHERE id = :id",
           nativeQuery = true)
    int recordReceive(@Param("id") UUID id,
                      @Param("now") OffsetDateTime now,
                      @Param("status") String status,
                      @Param("error") String error);
}

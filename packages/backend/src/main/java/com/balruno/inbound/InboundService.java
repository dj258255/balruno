// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

/** Public surface of the inbound webhook module (ADR 0029). */
public interface InboundService {

    InboundWebhook create(UUID callerUserId, UUID projectId, CreateInput input);

    List<InboundWebhook> listForProject(UUID callerUserId, UUID projectId);

    InboundWebhook findById(UUID inboundId);

    void delete(UUID callerUserId, UUID inboundId);

    /**
     * Public-read entry. The HTTP layer has already verified the
     * signature for 'github' (X-Hub-Signature-256) or the
     * X-Balruno-Signature header for 'generic'; this method does
     * the provider-specific mapping into a row.add wire op + applies
     * via the sync module.
     */
    ReceiveResult receive(UUID inboundId, String eventType, JsonNode body);

    record CreateInput(
            String provider,
            UUID targetSheetId,
            JsonNode columnMapping
    ) {}

    sealed interface ReceiveResult {
        record Accepted(UUID rowId) implements ReceiveResult {}
        record Ignored(String reason) implements ReceiveResult {}
        record Failed(String reason) implements ReceiveResult {}
    }
}

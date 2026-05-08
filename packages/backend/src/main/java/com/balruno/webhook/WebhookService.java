// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

/**
 * Public surface of the webhook module (ADR 0028).
 *
 * Authoring (CRUD) is project-member only.
 *
 * Publishing is in-process: callers from other modules invoke
 * {@link #publish} on TransactionSynchronization afterCommit so the
 * webhook fires *after* the originating DB transaction commits — a
 * partial outbound (event sent for a write that later rolled back)
 * is the failure mode we explicitly avoid.
 */
public interface WebhookService {

    Webhook create(UUID callerUserId, UUID projectId, String url, List<String> events);

    /** List webhooks of a project. The returned objects null out
     *  {@code secret} for safety — only the create() response carries
     *  the secret in plaintext. */
    List<Webhook> listForProject(UUID callerUserId, UUID projectId);

    /** Toggle active. Idempotent. */
    void setActive(UUID callerUserId, UUID webhookId, boolean active);

    void delete(UUID callerUserId, UUID webhookId);

    /**
     * Emit an event. Looks up active webhooks for the project, filters
     * to those subscribed to {@code event}, and POSTs the payload to
     * each URL with an HMAC-SHA256 signature in
     * {@code X-Balruno-Signature}. Failures are logged + counted in
     * the row's {@code last_*} columns; no retry loop in v1 (a real
     * queue lands when traffic warrants it).
     *
     * Caller is responsible for invoking via TransactionSynchronization
     * afterCommit to avoid emitting events for transactions that roll
     * back.
     */
    void publish(UUID projectId, String event, JsonNode payload);

    /** Initial event names — the create endpoint validates the
     *  user-supplied {@code events} array against this set. */
    List<String> KNOWN_EVENTS = List.of(
            "comment.added",
            "mention.created",
            "row.added"
    );
}

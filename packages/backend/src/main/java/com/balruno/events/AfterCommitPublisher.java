// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Publishes ApplicationEvents AFTER the surrounding transaction commits.
 *
 * Consolidates the "register a TransactionSynchronization that calls
 * events.publishEvent in afterCommit" pattern that was duplicated in
 * 8+ services with subtle inconsistencies (some logged failures, some
 * silently swallowed). One helper means one error-handling policy
 * (memory: silent failure 로깅 — never silent swallow; log + continue).
 *
 * Why afterCommit (not afterCompletion / inside @Transactional):
 *   - afterCommit fires only on successful commit. A rolled-back tx
 *     never publishes — prevents listeners reacting to events whose
 *     DB state was reverted.
 *   - Inside-tx publish runs the listener *before* commit, which
 *     violates the typical "react to a fact" semantics of events
 *     (the fact isn't durable yet).
 *
 * The {@link TransactionSynchronizationManager} call requires an
 * active transaction. Callers outside a tx (rare — mostly tests
 * or one-shot init) should use the wrapped event publisher
 * directly.
 */
@Component
public class AfterCommitPublisher {

    private static final Logger log = LoggerFactory.getLogger(AfterCommitPublisher.class);

    private final ApplicationEventPublisher events;

    AfterCommitPublisher(ApplicationEventPublisher events) {
        this.events = events;
    }

    /**
     * Schedule {@code event} to be published once the active
     * transaction commits. If no transaction is active, the event
     * publishes immediately (synchronous fallback).
     */
    public void publish(Object event) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            events.publishEvent(event);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            events.publishEvent(event);
                        } catch (Exception e) {
                            // Listener failures must not bubble back into
                            // the original commit path (the tx is already
                            // committed). Log + continue — operators see
                            // the failure in stack trace, no silent swallow.
                            log.error("afterCommit publish failed for {}",
                                    event.getClass().getSimpleName(), e);
                        }
                    }
                });
    }
}

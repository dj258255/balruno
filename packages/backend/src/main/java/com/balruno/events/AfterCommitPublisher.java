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
        runAfterCommit(() -> events.publishEvent(event),
                "publish " + event.getClass().getSimpleName());
    }

    /**
     * Run an arbitrary task after the active transaction commits.
     * Used by services whose post-commit work isn't an event publish
     * — broadcast notifications (sync.broadcastEvent), orphan cleanup
     * (storage.delete + counter decrement), etc.
     *
     * Same fallback as {@link #publish}: when no transaction is
     * active the task runs synchronously, so consumers don't need
     * to special-case test / one-shot init paths.
     */
    public void runAfterCommit(Runnable task) {
        runAfterCommit(task, "afterCommit task");
    }

    private void runAfterCommit(Runnable task, String description) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            try {
                task.run();
            } catch (Exception e) {
                log.error("{} failed (no-tx fallback)", description, e);
            }
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            task.run();
                        } catch (Exception e) {
                            // Listener / cleanup failures must not bubble
                            // back into the original commit path (the tx
                            // is already committed). Log + continue —
                            // operators see the failure in stack trace,
                            // no silent swallow.
                            log.error("{} failed", description, e);
                        }
                    }
                });
    }
}

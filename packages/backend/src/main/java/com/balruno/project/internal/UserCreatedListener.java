// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.ProjectService;
import com.balruno.user.UserCreatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Seeds the starter pack (default project + sample sheets) for a brand-new
 * user once the user/workspace creation transaction has committed.
 *
 * <p>Lives in the {@code project} module so {@code user} stays free of any
 * dependency on {@code project} — that one-way arrow is what keeps Spring
 * Modulith's {@code ArchitectureTest} green. Before the event split, both
 * modules imported each other (user called {@code ProjectService}, project
 * called {@code UserAuthService}) and the cycle failed verification.</p>
 *
 * <p>Phase {@code AFTER_COMMIT} is deliberate: a starter-pack failure
 * should not roll back the freshly-created user + workspace rows. The user
 * can still sign in and either retry from the empty-state UI or live
 * without seeded data; logs surface the failure for follow-up.</p>
 */
@Component
class UserCreatedListener {

    private static final Logger log = LoggerFactory.getLogger(UserCreatedListener.class);

    private final ProjectService projects;

    UserCreatedListener(ProjectService projects) {
        this.projects = projects;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onUserCreated(UserCreatedEvent event) {
        try {
            projects.createWithStarterPack(
                    event.workspaceId(),
                    event.userId(),
                    event.defaultProjectSlug(),
                    event.defaultProjectName(),
                    null,
                    event.locale());
        } catch (RuntimeException e) {
            log.error("Starter pack seeding failed for user {} (workspace {})",
                    event.userId(), event.workspaceId(), e);
        }
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import java.util.UUID;

/**
 * Published when a brand-new user finishes OAuth signup and gets the
 * default workspace seeded. Other modules (notably {@code project})
 * subscribe to do follow-up work — e.g. seeding a starter project +
 * sample sheets — without {@code user} having to depend on them.
 *
 * <p>Lives in {@code events} (leaf module, no module dependencies)
 * so {@code user} and {@code project} can both reference it without
 * either importing the other. This breaks the {@code user} ↔
 * {@code project} cycle that Spring Modulith's
 * {@code ArchitectureTest} originally flagged when {@code UserAuthServiceImpl}
 * directly injected {@code ProjectService}.</p>
 *
 * <p>The {@code locale} carries the user's preferred locale so the
 * starter pack JSON catalogue can be picked from the bundled set
 * without the listener having to look the user up again.</p>
 */
public record UserCreatedEvent(
        UUID userId,
        UUID workspaceId,
        String defaultProjectSlug,
        String defaultProjectName,
        String locale) {
}

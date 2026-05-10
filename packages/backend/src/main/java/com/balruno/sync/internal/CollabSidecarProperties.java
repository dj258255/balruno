// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Bound from {@code balruno.collab.sidecar.*}. Internal-only HTTP
 * channel from Spring to the Hocuspocus side-car. Today only
 * {@link DocDuplicateApiImpl} uses it (force-snapshot before clone),
 * but the shape is general — future maintenance ops (rebuild snapshot
 * cache, drain connections, etc.) ride here.
 *
 * Defaults assume the side-car runs on the same host (loopback) at
 * port 1235. Production overrides via the deploy's env vars.
 */
@ConfigurationProperties(prefix = "balruno.collab.sidecar")
record CollabSidecarProperties(
        /** Base URL of the side-car's internal HTTP listener. e.g. http://127.0.0.1:1235 */
        String url,
        /** Shared secret matching COLLAB_INTERNAL_SECRET on the side-car. */
        String secret,
        /** HTTP request timeout — short, since the snapshot path is local + cheap. */
        Duration timeout
) {
    CollabSidecarProperties {
        if (timeout == null) timeout = Duration.ofSeconds(2);
    }
}

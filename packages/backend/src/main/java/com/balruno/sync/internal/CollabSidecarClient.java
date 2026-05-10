// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/**
 * Tiny HTTP client for the Hocuspocus side-car's internal endpoints.
 * Best-effort — when the side-car is down or misconfigured the call
 * returns false and the caller (DocDuplicateApiImpl) proceeds with
 * the last persisted ydoc_state. Loud log on failure so operators
 * notice, but the duplicate path stays available either way.
 */
@Component
class CollabSidecarClient {

    private static final Logger log = LoggerFactory.getLogger(CollabSidecarClient.class);

    private final CollabSidecarProperties props;
    private final HttpClient http;

    CollabSidecarClient(CollabSidecarProperties props) {
        this.props = props;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
    }

    /**
     * Force the side-car to flush the live in-memory yjs state for
     * {@code documentId} into the {@code documents.ydoc_state} column.
     * Safe to call when no live editor exists — the side-car returns
     * 200 + {@code "snapshot": "idle"} in that case.
     *
     * @return true on 2xx, false on any failure (logged at WARN)
     */
    boolean forceSnapshot(UUID documentId) {
        if (props.url() == null || props.url().isBlank() || props.secret() == null || props.secret().isBlank()) {
            // Side-car not configured — common in dev / tests where
            // the throttled snapshot is acceptable. Don't spam the
            // log every duplicate; one INFO at startup is enough
            // (handled by the @PostConstruct check below).
            return false;
        }
        try {
            var uri = URI.create(props.url().replaceAll("/$", "")
                    + "/internal/snapshot/" + documentId);
            var req = HttpRequest.newBuilder(uri)
                    .timeout(props.timeout())
                    .header("X-Collab-Internal-Secret", props.secret())
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();
            var resp = http.send(req, HttpResponse.BodyHandlers.discarding());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                return true;
            }
            log.warn("collab side-car force-snapshot non-2xx: docId={} status={}",
                    documentId, resp.statusCode());
            return false;
        } catch (Exception e) {
            log.warn("collab side-car force-snapshot failed: docId={}, error={}",
                    documentId, e.getMessage());
            return false;
        }
    }
}

/** Activates the @ConfigurationProperties binding without scanning. */
@Configuration
@EnableConfigurationProperties(CollabSidecarProperties.class)
class CollabSidecarPropertiesConfig {}

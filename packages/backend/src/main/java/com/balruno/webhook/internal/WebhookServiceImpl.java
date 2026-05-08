// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook.internal;

import com.balruno.project.ProjectService;
import com.balruno.webhook.Webhook;
import com.balruno.webhook.WebhookService;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Default {@link WebhookService} implementation.
 *
 * Outbound posts are async — the publish() entry queues a Spring
 * {@code @Async} dispatch so the originating request thread isn't
 * blocked on the receiver's network. Failures are recorded in
 * {@code last_*} columns; v1 has no retry queue (a real queue lands
 * when traffic warrants).
 */
@Service
@EnableAsync
class WebhookServiceImpl implements WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookServiceImpl.class);

    private final WebhookRepository repo;
    private final ProjectService projects;

    /** databind autowired (tools.jackson in SB 4); we keep a fasterxml
     *  ObjectMapper locally for canonical JSON serialisation in the
     *  outbound payload (sign-then-send needs deterministic bytes). */
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    WebhookServiceImpl(WebhookRepository repo, ProjectService projects) {
        this.repo = repo;
        this.projects = projects;
    }

    @Override
    @Transactional
    public Webhook create(UUID callerUserId, UUID projectId, String url, List<String> events) {
        projects.findById(projectId, callerUserId);
        validateUrl(url);
        validateEvents(events);
        return repo.insert(projectId, url, events, callerUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Webhook> listForProject(UUID callerUserId, UUID projectId) {
        projects.findById(projectId, callerUserId);
        return repo.findByProjectId(projectId).stream()
                .map(WebhookServiceImpl::stripSecret)
                .toList();
    }

    @Override
    @Transactional
    public void setActive(UUID callerUserId, UUID webhookId, boolean active) {
        var webhook = repo.findById(webhookId);
        if (webhook == null) return;
        projects.findById(webhook.projectId(), callerUserId);
        repo.setActive(webhookId, active);
    }

    @Override
    @Transactional
    public void delete(UUID callerUserId, UUID webhookId) {
        var webhook = repo.findById(webhookId);
        if (webhook == null) return;
        projects.findById(webhook.projectId(), callerUserId);
        repo.delete(webhookId);
    }

    @Override
    public void publish(UUID projectId, String event, JsonNode payload) {
        // Repository call inside an async wrapper keeps the originating
        // request snappy. The lookup is cheap (partial index) so going
        // sync would also work; async future-proofs for higher fanout.
        dispatch(projectId, event, payload);
    }

    @Async
    void dispatch(UUID projectId, String event, JsonNode payload) {
        try {
            var subscribers = repo.findActiveSubscribers(projectId, event);
            for (var sub : subscribers) {
                deliver(sub, event, payload);
            }
        } catch (Exception e) {
            log.error("webhook dispatch failed projectId={} event={}", projectId, event, e);
        }
    }

    private void deliver(Webhook sub, String event, JsonNode payload) {
        try {
            var envelope = nodeMapper.createObjectNode();
            envelope.put("event", event);
            envelope.put("projectId", sub.projectId().toString());
            envelope.put("ts", System.currentTimeMillis());
            envelope.set("data", payload);
            var body = nodeMapper.writeValueAsBytes(envelope);
            var sig = signature(body, sub.secret());
            var req = HttpRequest.newBuilder()
                    .uri(URI.create(sub.url()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("X-Balruno-Event", event)
                    .header("X-Balruno-Signature", sig)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            var resp = http.send(req, HttpResponse.BodyHandlers.discarding());
            var ok = resp.statusCode() >= 200 && resp.statusCode() < 300;
            repo.recordAttempt(
                    sub.id(),
                    OffsetDateTime.now(),
                    resp.statusCode(),
                    ok ? null : "non-2xx response");
            if (!ok) {
                log.warn("webhook delivery non-2xx subId={} url={} status={}",
                        sub.id(), sub.url(), resp.statusCode());
            }
        } catch (Exception e) {
            log.warn("webhook delivery failed subId={} url={}: {}",
                    sub.id(), sub.url(), e.getMessage());
            repo.recordAttempt(sub.id(), OffsetDateTime.now(), null, e.getMessage());
        }
    }

    private static String signature(byte[] body, UUID secret) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.toString().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC compute failed", e);
        }
    }

    private static void validateUrl(String url) {
        if (url == null || url.isBlank() || !url.startsWith("https://")) {
            throw new IllegalArgumentException("webhook url must be https");
        }
    }

    private static void validateEvents(List<String> events) {
        if (events == null || events.isEmpty()) {
            throw new IllegalArgumentException("at least one event required");
        }
        for (var e : events) {
            if (!KNOWN_EVENTS.contains(e)) {
                throw new IllegalArgumentException("unknown event: " + e);
            }
        }
    }

    /** Strip secret from list responses so it can't leak to non-creators. */
    static Webhook stripSecret(Webhook w) {
        return new Webhook(
                w.id(), w.projectId(), w.url(), w.events(), null, w.active(),
                w.lastAttemptAt(), w.lastStatusCode(), w.lastError(),
                w.createdBy(), w.createdAt());
    }
}

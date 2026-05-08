// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.WebPushSubscription;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.Subscription.Keys;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.security.Security;
import java.time.OffsetDateTime;

/**
 * Web Push delivery via VAPID (RFC 8292). Uses
 * {@code nl.martijndwars:web-push} — does the JWT signing, ECDH
 * key derivation, and push gateway HTTP for us.
 *
 * Two operator-facing properties:
 *   balruno.notification.webpush.vapid-public-key
 *   balruno.notification.webpush.vapid-private-key
 * Generated once with {@code npx web-push generate-vapid-keys} and
 * stashed in the env vault. The public key gets handed to the
 * frontend at /api/v1/notification/vapid-public-key — the browser
 * embeds it when calling pushManager.subscribe(), so the push
 * gateway can verify our future POSTs.
 */
@Service
class WebPushDispatcher {

    private static final Logger log = LoggerFactory.getLogger(WebPushDispatcher.class);

    static {
        // BouncyCastle provider — required for the secp256r1 curve
        // operations the VAPID signature uses. Loaded once at class
        // init; safe to add even if already present (Security#addProvider
        // is idempotent for our purposes — returns -1 if already there).
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private final String publicKey;
    private final String privateKey;
    private final String subject;

    private PushService pushService;
    private final NotificationRepository repo;

    WebPushDispatcher(
            NotificationRepository repo,
            @Value("${balruno.notification.webpush.vapid-public-key:}") String publicKey,
            @Value("${balruno.notification.webpush.vapid-private-key:}") String privateKey,
            @Value("${balruno.notification.webpush.vapid-subject:mailto:noreply@balruno.com}") String subject) {
        this.repo = repo;
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
    }

    @PostConstruct
    void init() throws Exception {
        if (publicKey.isBlank() || privateKey.isBlank()) {
            log.warn("VAPID keys not configured — Web Push disabled. "
                    + "Set balruno.notification.webpush.vapid-{public,private}-key.");
            return;
        }
        pushService = new PushService(publicKey, privateKey, subject);
    }

    boolean isReady() {
        return pushService != null;
    }

    String publicKey() {
        return publicKey;
    }

    void send(WebPushSubscription sub, String payloadJson) {
        if (pushService == null) return;
        try {
            var subscription = new Subscription(
                    sub.endpoint(),
                    new Keys(sub.p256dh(), sub.auth()));
            var notification = new Notification(subscription, payloadJson);
            var resp = pushService.send(notification);
            int code = resp.getStatusLine().getStatusCode();
            if (code == 410 || code == 404) {
                // Browser permanently dropped the subscription —
                // remove the row so future fanouts skip it.
                repo.deleteByEndpoint(sub.endpoint());
                log.info("dropped expired push subscription endpoint={}", sub.endpoint());
            } else if (code >= 200 && code < 300) {
                repo.touchLastUsed(sub.id(), OffsetDateTime.now());
            } else {
                log.warn("web push gateway non-2xx status={} endpoint={}", code, sub.endpoint());
            }
        } catch (Exception e) {
            log.warn("web push send failed endpoint={} reason={}", sub.endpoint(), e.getMessage());
        }
    }
}

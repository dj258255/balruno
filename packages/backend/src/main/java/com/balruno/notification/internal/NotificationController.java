// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.NotificationPreference;
import com.balruno.notification.NotificationService;
import com.balruno.notification.WebPushSubscription;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST surface for notification prefs + Web Push subscriptions
 * (ADR 0024 Stage I).
 *
 *   GET  /v1/me/notification-preferences         — read
 *   PUT  /v1/me/notification-preferences         — update
 *   GET  /v1/notification/vapid-public-key       — frontend SW init
 *   POST /v1/me/web-push-subscriptions           — subscribe
 *   GET  /v1/me/web-push-subscriptions           — list
 *   DELETE /v1/me/web-push-subscriptions/{id}    — revoke
 */
@RestController
@Tag(name = "Notification")
class NotificationController {

    private final NotificationService notifications;

    NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping(path = "/me/notification-preferences", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    NotificationPreference get(@AuthenticationPrincipal Jwt jwt) {
        return notifications.getPreference(callerId(jwt));
    }

    @PutMapping(path = "/me/notification-preferences", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    NotificationPreference update(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody @Valid UpdateRequest body) {
        return notifications.updatePreference(callerId(jwt),
                new NotificationService.UpdatePreferenceInput(
                        body.emailOnMention(),
                        body.emailOnCommentReply(),
                        body.pushOnMention(),
                        body.pushOnCommentReply(),
                        body.digestFrequency()));
    }

    /** Public — frontend reads at startup before calling
     *  pushManager.subscribe. Returning the key here means we don't
     *  have to bake it into env-NEXT_PUBLIC vars on the web build. */
    @GetMapping(path = "/notification/vapid-public-key", version = "1")
    Map<String, String> vapidPublicKey() {
        return Map.of("publicKey", notifications.vapidPublicKey());
    }

    @PostMapping(path = "/me/web-push-subscriptions", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    @SecurityRequirement(name = "bearerAuth")
    WebPushSubscription subscribe(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody @Valid SubscribeRequest body,
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        return notifications.saveSubscription(callerId(jwt),
                new NotificationService.SaveSubscriptionInput(
                        body.endpoint(), body.p256dh(), body.auth(), userAgent));
    }

    @GetMapping(path = "/me/web-push-subscriptions", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    List<WebPushSubscription> listSubscriptions(@AuthenticationPrincipal Jwt jwt) {
        return notifications.listSubscriptions(callerId(jwt));
    }

    @DeleteMapping(path = "/me/web-push-subscriptions/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearerAuth")
    void unsubscribe(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        notifications.deleteSubscription(callerId(jwt), id);
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    record UpdateRequest(
            Boolean emailOnMention,
            Boolean emailOnCommentReply,
            Boolean pushOnMention,
            Boolean pushOnCommentReply,
            String digestFrequency
    ) {}

    record SubscribeRequest(
            @NotEmpty String endpoint,
            @NotEmpty String p256dh,
            @NotEmpty String auth
    ) {}
}

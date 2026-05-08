// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.billing.internal;

import com.balruno.billing.BillingService;
import com.balruno.workspace.WorkspaceService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * REST surface for billing (ADR 0004).
 *
 *   POST /v1/workspaces/{id}/billing/checkout       — JWT, member only
 *   POST /v1/workspaces/{id}/billing/portal         — JWT, member only
 *   POST /v1/billing/stripe-webhook                 — public, signature verified
 */
@RestController
@Tag(name = "Billing")
class BillingController {

    private static final Logger log = LoggerFactory.getLogger(BillingController.class);

    private final BillingService billing;
    private final BillingServiceImpl billingImpl;
    private final WorkspaceService workspaces;

    @Value("${balruno.billing.stripe.webhook-secret:}")
    private String webhookSecret;

    BillingController(BillingService billing, BillingServiceImpl billingImpl,
                      WorkspaceService workspaces) {
        this.billing = billing;
        this.billingImpl = billingImpl;
        this.workspaces = workspaces;
    }

    @PostMapping(path = "/workspaces/{workspaceId}/billing/checkout", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    Map<String, String> checkout(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId,
            @RequestBody @Valid CheckoutRequest body) {
        var caller = callerId(jwt);
        requireMember(caller, workspaceId);
        var url = billing.createCheckoutSession(caller, workspaceId, body.plan(),
                body.successUrl(), body.cancelUrl());
        return Map.of("url", url);
    }

    @PostMapping(path = "/workspaces/{workspaceId}/billing/portal", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    Map<String, String> portal(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId,
            @RequestBody @Valid PortalRequest body) {
        var caller = callerId(jwt);
        requireMember(caller, workspaceId);
        var url = billing.createPortalSession(caller, workspaceId, body.returnUrl());
        return Map.of("url", url);
    }

    /** Stripe webhook — signature verification on the raw payload.
     *  Permitted via SecurityConfig (signature header IS the auth). */
    @PostMapping(path = "/billing/stripe-webhook", version = "1")
    ResponseEntity<String> webhook(
            @RequestHeader("Stripe-Signature") String signature,
            @RequestBody String rawBody) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("billing webhook not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(rawBody, signature, webhookSecret);
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("bad signature");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
        try {
            handle(event);
            return ResponseEntity.ok("ok");
        } catch (Exception e) {
            log.error("webhook handling failed event={}", event.getType(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("handler error");
        }
    }

    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private void handle(Event event) {
        switch (event.getType()) {
            case "checkout.session.completed",
                 "customer.subscription.updated",
                 "customer.subscription.created",
                 "customer.subscription.deleted" -> {
                // Stripe SDK delivers the event payload as a raw JSON
                // string we parse ourselves; the typed deserializer
                // can't always resolve the API version we receive.
                var rawJson = event.getDataObjectDeserializer().getRawJson();
                if (rawJson == null) return;
                try {
                    var node = nodeMapper.readTree(rawJson);
                    var customerId = textOrNull(node, "customer");
                    var subscriptionId = textOrNull(node, "id");
                    var status = textOrNull(node, "status");
                    Long currentPeriodEnd = node.has("current_period_end")
                            && !node.get("current_period_end").isNull()
                            ? node.get("current_period_end").asLong()
                            : null;
                    String plan = null;
                    var meta = node.get("metadata");
                    if (meta != null && meta.isObject() && meta.has("plan")
                            && !meta.get("plan").isNull()) {
                        plan = meta.get("plan").asText();
                    }
                    if ("customer.subscription.deleted".equals(event.getType())) {
                        plan = "FREE";
                        status = "canceled";
                    }
                    billingImpl.onSubscriptionChanged(
                            customerId, subscriptionId, status, currentPeriodEnd, plan);
                } catch (Exception e) {
                    log.warn("stripe webhook payload parse failed: {}", e.getMessage());
                }
            }
            default -> log.debug("ignoring stripe event type={}", event.getType());
        }
    }

    private static String textOrNull(com.fasterxml.jackson.databind.JsonNode node, String key) {
        var v = node.get(key);
        return v != null && !v.isNull() ? v.asText() : null;
    }

    private void requireMember(UUID userId, UUID workspaceId) {
        var memberships = workspaces.listForUser(userId);
        var match = memberships.stream().anyMatch(w -> w.id().equals(workspaceId));
        if (!match) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.NOT_FOUND, "workspace not found");
        }
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    record CheckoutRequest(
            @NotEmpty String plan,         // 'PRO' or 'TEAM'
            @NotEmpty String successUrl,
            @NotEmpty String cancelUrl
    ) {}

    record PortalRequest(@NotEmpty String returnUrl) {}
}

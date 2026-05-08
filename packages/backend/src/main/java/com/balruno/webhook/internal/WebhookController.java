// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook.internal;

import com.balruno.project.ProjectService;
import com.balruno.webhook.Webhook;
import com.balruno.webhook.WebhookService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST surface for webhooks (ADR 0028 outbound).
 *
 *   POST   /v1/projects/{id}/webhooks       — create
 *   GET    /v1/projects/{id}/webhooks       — list (secret nulled)
 *   PATCH  /v1/webhooks/{id}                — toggle active
 *   DELETE /v1/webhooks/{id}                — delete
 */
@RestController
@Tag(name = "Webhook")
@SecurityRequirement(name = "bearerAuth")
class WebhookController {

    private final WebhookService webhooks;
    private final ProjectService projects;

    WebhookController(WebhookService webhooks, ProjectService projects) {
        this.webhooks = webhooks;
        this.projects = projects;
    }

    /**
     * Project membership lives in the controller (not the service)
     * so the webhook module doesn't import the project module —
     * Spring Modulith's ArchitectureTest forbids the back edge that
     * would create. ProjectService.findById throws 404 for non-
     * members; that error propagates straight through to the HTTP
     * response.
     */
    @PostMapping(path = "/projects/{projectId}/webhooks", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Webhook create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestBody @Valid CreateRequest body) {
        var caller = callerId(jwt);
        projects.findById(projectId, caller);
        return webhooks.create(caller, projectId, body.url(), body.events());
    }

    @GetMapping(path = "/projects/{projectId}/webhooks", version = "1")
    List<Webhook> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId) {
        var caller = callerId(jwt);
        projects.findById(projectId, caller);
        return webhooks.listForProject(caller, projectId);
    }

    @PatchMapping(path = "/webhooks/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void toggle(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestBody @Valid ToggleRequest body) {
        var caller = callerId(jwt);
        var webhook = webhooks.findById(id);
        if (webhook == null) return;
        projects.findById(webhook.projectId(), caller);
        webhooks.setActive(caller, id, body.active());
    }

    @DeleteMapping(path = "/webhooks/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        var caller = callerId(jwt);
        var webhook = webhooks.findById(id);
        if (webhook == null) return;
        projects.findById(webhook.projectId(), caller);
        webhooks.delete(caller, id);
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    record CreateRequest(
            @NotNull String url,
            @NotEmpty List<String> events
    ) {}

    record ToggleRequest(boolean active) {}
}

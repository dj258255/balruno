// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound.internal;

import com.balruno.inbound.InboundService;
import com.balruno.inbound.InboundWebhook;
import com.balruno.project.ProjectService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST surface for inbound webhooks (ADR 0029).
 *
 * Authoring (CRUD) — JWT + project member.
 * Public receive (GitHub / generic) — no JWT, signature header is
 * the auth. Permitted via SecurityConfig.
 */
@RestController
@Tag(name = "InboundWebhook")
class InboundController {

    private final InboundService inbound;
    private final ProjectService projects;
    private final ObjectMapper json = new ObjectMapper();

    InboundController(InboundService inbound, ProjectService projects) {
        this.inbound = inbound;
        this.projects = projects;
    }

    // ── Authoring (member-only) ─────────────────────────────────────────

    @PostMapping(path = "/projects/{projectId}/inbound-webhooks", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    @SecurityRequirement(name = "bearerAuth")
    InboundWebhook create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestBody @Valid CreateRequest body) {
        var caller = callerId(jwt);
        projects.findById(projectId, caller);
        return inbound.create(caller, projectId, new InboundService.CreateInput(
                body.provider(), body.targetSheetId(), body.columnMapping()));
    }

    @GetMapping(path = "/projects/{projectId}/inbound-webhooks", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    List<InboundWebhook> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId) {
        var caller = callerId(jwt);
        projects.findById(projectId, caller);
        return inbound.listForProject(caller, projectId);
    }

    @DeleteMapping(path = "/inbound-webhooks/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearerAuth")
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        var caller = callerId(jwt);
        var hook = inbound.findById(id);
        if (hook == null) return;
        projects.findById(hook.projectId(), caller);
        inbound.delete(caller, id);
    }

    // ── Public receive — provider-specific signature verification ───────

    /** GitHub posts here; we verify X-Hub-Signature-256, dispatch by
     *  X-GitHub-Event header into the mapper. */
    @PostMapping(path = "/inbound-public/{id}/github", version = "1")
    ResponseEntity<Map<String, Object>> receiveGitHub(
            @PathVariable UUID id,
            @RequestHeader("X-Hub-Signature-256") String signature,
            @RequestHeader(value = "X-GitHub-Event", required = false) String eventType,
            @RequestBody String rawBody) {
        var hook = inbound.findById(id);
        if (hook == null || !"github".equals(hook.provider())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "not found"));
        }
        if (!verifyGitHubSignature(signature, rawBody, hook.secret())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "bad signature"));
        }
        try {
            var body = json.readTree(rawBody);
            var result = inbound.receive(hook.id(), eventType == null ? "" : eventType, body);
            return ResponseEntity.accepted().body(Map.of("status", result.getClass().getSimpleName()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /** Generic provider — caller signs the body the same way (HMAC-SHA256
     *  over the raw body with the secret) and presents X-Balruno-Signature. */
    @PostMapping(path = "/inbound-public/{id}/generic", version = "1")
    ResponseEntity<Map<String, Object>> receiveGeneric(
            @PathVariable UUID id,
            @RequestHeader("X-Balruno-Signature") String signature,
            @RequestBody String rawBody) {
        var hook = inbound.findById(id);
        if (hook == null || !"generic".equals(hook.provider())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "not found"));
        }
        if (!verifyHmac(signature, rawBody, hook.secret())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "bad signature"));
        }
        try {
            var body = json.readTree(rawBody);
            var result = inbound.receive(hook.id(), "generic", body);
            return ResponseEntity.accepted().body(Map.of("status", result.getClass().getSimpleName()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private static boolean verifyGitHubSignature(String header, String body, UUID secret) {
        // GitHub format: "sha256=<hex>"
        if (header == null || !header.startsWith("sha256=")) return false;
        var expected = "sha256=" + hmacHex(body, secret);
        return constantTimeEquals(header, expected);
    }

    private static boolean verifyHmac(String header, String body, UUID secret) {
        if (header == null) return false;
        var expected = "sha256=" + hmacHex(body, secret);
        return constantTimeEquals(header, expected);
    }

    private static String hmacHex(String body, UUID secret) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.toString().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC compute failed", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) diff |= a.charAt(i) ^ b.charAt(i);
        return diff == 0;
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    record CreateRequest(
            @NotNull String provider,
            @NotNull UUID targetSheetId,
            JsonNode columnMapping
    ) {}
}

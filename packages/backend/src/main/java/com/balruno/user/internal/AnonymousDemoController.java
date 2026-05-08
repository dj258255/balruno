// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Public landing-page demo (ADR 0035, 2026-05-08).
 *
 * Excalidraw home pattern: a brand-new visitor lands on
 * {@code balruno.com} and is dropped straight into a working
 * collaborative sheet. The frontend POSTs to
 * {@code /api/v1/demo/anonymous-session} when {@code BackendAuth}
 * resolves to anonymous; the response sets the same
 * {@code balruno_session} cookie that OAuth login does, so all
 * subsequent traffic — sync WebSocket, project loads, sheet edits
 * — flows through the existing JWT path without any client-side
 * branching.
 *
 * Lives next to {@link OAuth2LoginSuccessHandler} on purpose: both
 * are session-cookie issuers, both pull from {@link JwtProperties}
 * for cookie domain / TTL / name. Putting this in a separate
 * {@code com.balruno.demo} module would force {@code JwtProperties}
 * to leak into a public surface — Modulith-clean, but real-world
 * dirty (a Java config object becoming a public DTO).
 *
 * Security boundary:
 *   - Endpoint is permitAll in {@link SecurityConfig}.
 *   - The issued JWT is bound to the seeded demo user
 *     ({@code 00000000-0000-0000-0000-0000000d3000}) which is
 *     only a member of the {@code demo} workspace. Every other
 *     resource's membership check rejects the token naturally.
 *   - The {@code name} claim carries a per-call random suffix so
 *     two browser tabs of the same anonymous visitor see distinct
 *     presence labels.
 */
@RestController
@Tag(name = "Demo")
class AnonymousDemoController {

    /** Hex-only UUID seeded by V23 — survives PG's parser. */
    private static final UUID ANONYMOUS_USER_ID =
            UUID.fromString("00000000-0000-0000-0000-0000000d3000");

    private static final String DEMO_WORKSPACE_SLUG = "demo";
    private static final String DEMO_PROJECT_SLUG = "playground";

    private final UserRepository userRepo;
    private final JwtIssuer jwtIssuer;
    private final JwtProperties props;
    private final SecureRandom rng = new SecureRandom();

    AnonymousDemoController(UserRepository userRepo, JwtIssuer jwtIssuer, JwtProperties props) {
        this.userRepo = userRepo;
        this.jwtIssuer = jwtIssuer;
        this.props = props;
    }

    @PostMapping(path = "/demo/anonymous-session", version = "1")
    Map<String, Object> startAnonymousSession(HttpServletResponse response) {
        var u = userRepo.findById(ANONYMOUS_USER_ID)
                .orElseThrow(() -> new NoSuchElementException("demo user not seeded — V23 missing"));

        var label = "Demo Visitor #" + (1000 + rng.nextInt(9000));
        var principal = new AuthenticatedUser(
                u.getId(),
                u.getEmail(),
                label,
                u.getAvatarUrl(),
                u.getLocale());
        var token = jwtIssuer.issueAccessToken(principal);

        response.addCookie(buildSessionCookie(token));

        return Map.of(
                "displayName", label,
                "workspaceSlug", DEMO_WORKSPACE_SLUG,
                "projectSlug", DEMO_PROJECT_SLUG);
    }

    private Cookie buildSessionCookie(String tokenValue) {
        var cookie = new Cookie(props.cookieName(), tokenValue);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setDomain(props.cookieDomain());
        cookie.setAttribute("SameSite", "Lax");
        cookie.setMaxAge((int) props.accessTokenTtl().toSeconds());
        return cookie;
    }
}

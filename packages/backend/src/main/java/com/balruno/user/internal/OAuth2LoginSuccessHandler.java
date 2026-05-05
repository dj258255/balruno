// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import com.balruno.user.OAuthLogin;
import com.balruno.user.OAuthProvider;
import com.balruno.user.UserAuthException;
import com.balruno.user.UserAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Bridges Spring Security's OAuth login completion into our user module:
 * 1. translate provider attributes → {@link OAuthLogin},
 * 2. ask the {@link UserAuthService} to upsert the user,
 * 3. mint a self-issued JWT,
 * 4. set it as an httpOnly cookie scoped to {@code .balruno.com},
 * 5. redirect the browser back to the SPA's auth-callback page.
 *
 * Anything that throws here ends in a redirect back to the frontend with
 * an {@code error=} query parameter — never to a Spring error page that
 * leaks stack info.
 */
@Component
class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserAuthService userAuthService;
    private final JwtIssuer jwtIssuer;
    private final JwtProperties props;

    OAuth2LoginSuccessHandler(UserAuthService userAuthService, JwtIssuer jwtIssuer, JwtProperties props) {
        this.userAuthService = userAuthService;
        this.jwtIssuer = jwtIssuer;
        this.props = props;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        if (!(authentication instanceof OAuth2AuthenticationToken oauth)) {
            redirectWithError(request, response, "invalid_authentication");
            return;
        }

        try {
            var login = toOAuthLogin(oauth);
            AuthenticatedUser user = userAuthService.findOrCreateOnOAuth(login);
            var token = jwtIssuer.issueAccessToken(user);
            response.addCookie(buildSessionCookie(token));
            redirectToFrontend(request, response, "ok");
        } catch (UserAuthException e) {
            redirectWithError(request, response, e.reason().name().toLowerCase(Locale.ROOT));
        } catch (RuntimeException e) {
            redirectWithError(request, response, "login_failed");
        }
    }

    private OAuthLogin toOAuthLogin(OAuth2AuthenticationToken oauth) {
        var registrationId = oauth.getAuthorizedClientRegistrationId();
        var provider = switch (registrationId) {
            case "github" -> OAuthProvider.GITHUB;
            case "google" -> OAuthProvider.GOOGLE;
            default -> throw new IllegalStateException("unknown provider: " + registrationId);
        };
        var principal = oauth.getPrincipal();
        return switch (provider) {
            case GITHUB -> fromGitHub(principal);
            case GOOGLE -> fromGoogle(principal);
        };
    }

    private OAuthLogin fromGitHub(OAuth2User user) {
        var attrs = user.getAttributes();
        // GitHubOAuth2UserService injects email + email_verified for us.
        var email = (String) attrs.get("email");
        var verified = Boolean.TRUE.equals(attrs.get("email_verified"));
        var providerUserId = String.valueOf(attrs.get("id"));
        var name = (String) attrs.getOrDefault("name", attrs.get("login"));
        var avatar = (String) attrs.get("avatar_url");
        return new OAuthLogin(OAuthProvider.GITHUB, providerUserId, email, verified, name, avatar);
    }

    private OAuthLogin fromGoogle(OAuth2User user) {
        // OidcUser when Google's openid scope is in play. Both DefaultOAuth2User
        // and OidcUser route through OAuth2User#getAttributes so the same
        // attribute map shape applies.
        var attrs = user.getAttributes();
        var email = (String) attrs.get("email");
        var verified = Boolean.TRUE.equals(attrs.get("email_verified"));
        var providerUserId = (String) attrs.get(user instanceof OidcUser ? "sub" : "sub");
        var name = (String) attrs.get("name");
        var avatar = (String) attrs.get("picture");
        return new OAuthLogin(OAuthProvider.GOOGLE, providerUserId, email, verified, name, avatar);
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

    private void redirectToFrontend(HttpServletRequest request, HttpServletResponse response, String status) throws IOException {
        var url = UriComponentsBuilder.fromUriString(props.frontendRedirectBase())
                .path("/auth/callback")
                .queryParam("status", status)
                .build()
                .toUriString();
        getRedirectStrategy().sendRedirect(request, response, url);
    }

    private void redirectWithError(HttpServletRequest request, HttpServletResponse response, String code) throws IOException {
        var url = UriComponentsBuilder.fromUriString(props.frontendRedirectBase())
                .path("/auth/callback")
                .queryParam("status", "error")
                .queryParam("error", URLEncoder.encode(code, StandardCharsets.UTF_8))
                .build()
                .toUriString();
        getRedirectStrategy().sendRedirect(request, response, url);
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * GitHub's /user endpoint returns the email field only when the user has
 * made it public, and never tells us whether it is verified. To make
 * the verified-email auto-link rule work for GitHub, we additionally
 * call /user/emails (which requires the {@code user:email} scope) and
 * surface the primary verified address as a synthetic
 * {@code email_verified} attribute the success handler can read.
 *
 * If GitHub returns no verified primary email at all, the attributes
 * are left untouched — the link rule's "no verified email" branch
 * fires and a brand-new user is created.
 */
@Component
class GitHubOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private static final String NAME_ATTRIBUTE = "id";
    private static final URI EMAILS_URI = URI.create("https://api.github.com/user/emails");

    private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
    private final RestClient restClient = RestClient.create();

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        var registrationId = request.getClientRegistration().getRegistrationId();
        var user = delegate.loadUser(request);
        if (!"github".equals(registrationId)) {
            return user;
        }

        var attrs = new HashMap<>(user.getAttributes());
        var primary = fetchPrimaryVerifiedEmail(request.getAccessToken().getTokenValue());
        if (primary != null) {
            attrs.put("email", primary.email());
            attrs.put("email_verified", primary.verified());
        }
        return new DefaultOAuth2User(user.getAuthorities(), attrs, NAME_ATTRIBUTE);
    }

    private GithubEmail fetchPrimaryVerifiedEmail(String accessToken) {
        List<Map<String, Object>> rows = restClient.get()
                .uri(EMAILS_URI)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .accept(MediaType.parseMediaType("application/vnd.github+json"))
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
        if (rows == null) {
            return null;
        }
        for (var row : rows) {
            var primary = Boolean.TRUE.equals(row.get("primary"));
            var verified = Boolean.TRUE.equals(row.get("verified"));
            if (primary && verified) {
                return new GithubEmail((String) row.get("email"), true);
            }
        }
        return null;
    }

    private record GithubEmail(String email, boolean verified) {}
}

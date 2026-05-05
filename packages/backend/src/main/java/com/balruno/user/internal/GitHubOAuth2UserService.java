// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * GitHub's /user endpoint returns the email field only when the user has
 * marked their email public — and never tells us if it's verified. To
 * make the verified-email auto-link rule work for GitHub, we additionally
 * call /user/emails (which requires the {@code user:email} scope) and
 * surface the primary verified address as a synthetic
 * {@code email_verified} attribute the success handler can read.
 *
 * If GitHub returns no verified primary email at all, we leave the
 * attributes alone — the link rule's "no verified email" branch fires
 * and a brand-new user is created.
 */
@Component
class GitHubOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private static final String NAME_ATTRIBUTE = "id";
    private static final URI EMAILS_URI = URI.create("https://api.github.com/user/emails");

    private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
    private final RestTemplate restTemplate = new RestTemplate();

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
        var headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.set("Accept", "application/vnd.github+json");
        var request = new RequestEntity<>(headers, HttpMethod.GET, EMAILS_URI);
        var response = restTemplate.exchange(
                request,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {});
        if (response.getBody() == null) {
            return null;
        }
        for (var row : response.getBody()) {
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

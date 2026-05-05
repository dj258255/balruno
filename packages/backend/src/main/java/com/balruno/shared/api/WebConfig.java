// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.accept.ApiVersionParser;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.ApiVersionConfigurer;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring Framework 7's declarative API versioning, path-segment style.
 *
 * Two pieces are required:
 *   1. {@link #configurePathMatch} auto-prefixes every {@link RestController}
 *      with {@code /api/{version}}, turning the URL segment into a path
 *      variable so Spring's PathPatternParser strips it from the route
 *      match. Without this, the URL {@code /api/v1/me} fails to match
 *      {@code @GetMapping("/me")} because the literal {@code /api/v1/...}
 *      remains in the request path.
 *   2. {@link #configureApiVersioning} reads segment 1 of the URL as the
 *      version, strips a leading "v" via the custom parser, and rejects
 *      anything outside the supported list.
 *
 * Controllers therefore declare just the resource path on their methods
 * (e.g. {@code @GetMapping(path = "/me", version = "1")}) and adding
 * v2 is a one-line addition to {@link #addSupportedVersionsList} plus
 * a sibling method annotated {@code version = "2"}.
 */
@Configuration
class WebConfig implements WebMvcConfigurer {

    @Override
    public void configureApiVersioning(ApiVersionConfigurer configurer) {
        configurer
                .usePathSegment(1)
                .setVersionParser(new StripVPrefixParser())
                .addSupportedVersions(addSupportedVersionsList());
    }

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix(
                "/api/{version}",
                clazz -> clazz.isAnnotationPresent(RestController.class));
    }

    /** Currently supported major versions. New versions append here. */
    private static String[] addSupportedVersionsList() {
        return new String[] { "1" };
    }

    /**
     * Spring's default {@code SemanticApiVersionParser} would reject
     * "v1" outright. Strip a leading "v" if present and pass the rest
     * through as the version string.
     */
    private static final class StripVPrefixParser implements ApiVersionParser<String> {
        @Override
        public String parseVersion(String version) {
            return version != null && version.startsWith("v")
                    ? version.substring(1)
                    : version;
        }
    }
}

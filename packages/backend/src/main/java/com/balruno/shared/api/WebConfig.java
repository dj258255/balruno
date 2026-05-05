// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.accept.ApiVersionParser;
import org.springframework.web.servlet.config.annotation.ApiVersionConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Wires Spring Framework 7's declarative API versioning. The version
 * lives in the URL path segment immediately after {@code /api}; the
 * leading {@code v} is stripped before matching, so that
 * {@code /api/v1/me} routes to a handler annotated with
 * {@code @GetMapping(path = "/me", version = "1")}.
 *
 * Adding a v2 later means a new method on the same controller (or a
 * separate controller) annotated with {@code version = "2"} and
 * extending {@link #addSupportedVersionsList} below — no changes to URL
 * patterns or per-controller {@code @RequestMapping} prefixes.
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

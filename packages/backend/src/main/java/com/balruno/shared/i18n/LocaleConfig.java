// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.i18n;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.util.List;
import java.util.Locale;

/**
 * Per-request locale resolution. {@link AcceptHeaderLocaleResolver}
 * reads the {@code Accept-Language} header on every request and
 * publishes the resolved {@link Locale} via Spring's
 * {@code LocaleContextHolder} — services that need to render a
 * locale-specific string ({@code (복사)} / {@code (copy)} etc.) ask
 * {@link org.springframework.context.MessageSource} for the matching
 * resource bundle entry.
 *
 * Supported locales:
 *   - en (fallback / default for any unmatched header)
 *   - ko / ko-KR
 *
 * Default locale defaults to ko, matching the current primary user
 * base. A client without an Accept-Language header lands on Korean
 * strings — the same behaviour the codebase had before this i18n
 * indirection was introduced.
 */
@Configuration
class LocaleConfig {

    @Bean
    LocaleResolver localeResolver() {
        var resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.KOREAN);
        resolver.setSupportedLocales(List.of(Locale.KOREAN, Locale.ENGLISH));
        return resolver;
    }
}

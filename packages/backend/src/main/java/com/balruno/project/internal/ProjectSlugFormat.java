// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.ProjectException;

import java.util.regex.Pattern;

/**
 * Project slug format check. Same regex as the workspace slug rule
 * (3-30 chars, lowercase + alphanum + hyphen, must not start with a
 * hyphen) — but no global reserved-word list, since project slugs are
 * scoped to a workspace and never appear at a top-level URL.
 */
final class ProjectSlugFormat {

    private static final Pattern PATTERN = Pattern.compile("^[a-z0-9][a-z0-9-]{2,29}$");

    private ProjectSlugFormat() {}

    static void validate(String slug) {
        if (slug == null || !PATTERN.matcher(slug).matches()) {
            throw new ProjectException(
                    ProjectException.Reason.SLUG_INVALID,
                    "Slug must match [a-z0-9][a-z0-9-]{2,29}.");
        }
    }
}

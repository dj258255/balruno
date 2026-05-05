// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.ProjectException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProjectSlugFormatTest {

    @Test
    void accepts_typical_slugs() {
        ProjectSlugFormat.validate("my-game");
        ProjectSlugFormat.validate("balance-v2");
        ProjectSlugFormat.validate("p1x");                              // 3 chars (min)
        ProjectSlugFormat.validate("a23456789012345678901234567890");   // 30 chars (max)
    }

    @Test
    void rejects_short_form() {
        assertThatThrownBy(() -> ProjectSlugFormat.validate("ab"))
                .isInstanceOf(ProjectException.class);
    }

    @Test
    void rejects_long_form() {
        assertThatThrownBy(() -> ProjectSlugFormat.validate("a23456789012345678901234567890x"))
                .isInstanceOf(ProjectException.class);
    }

    @Test
    void rejects_uppercase() {
        assertThatThrownBy(() -> ProjectSlugFormat.validate("MyGame"))
                .isInstanceOf(ProjectException.class);
    }

    @Test
    void rejects_leading_hyphen_and_underscore() {
        assertThatThrownBy(() -> ProjectSlugFormat.validate("-game"))
                .isInstanceOf(ProjectException.class);
        assertThatThrownBy(() -> ProjectSlugFormat.validate("my_game"))
                .isInstanceOf(ProjectException.class);
    }

    @Test
    void allows_workspace_reserved_words_inside_a_workspace() {
        // Project slugs are scoped to a workspace, so the workspace's
        // global reserved word list does not apply.
        ProjectSlugFormat.validate("api");
        ProjectSlugFormat.validate("admin");
    }

    @Test
    void invalid_uses_correct_reason() {
        try {
            ProjectSlugFormat.validate("X");
        } catch (ProjectException e) {
            assertThat(e.reason()).isEqualTo(ProjectException.Reason.SLUG_INVALID);
        }
    }
}

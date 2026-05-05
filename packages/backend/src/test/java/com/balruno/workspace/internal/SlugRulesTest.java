// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.WorkspaceException;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SlugRulesTest {

    @Nested
    class Valid {
        @Test
        void accepts_simple_lowercase() {
            SlugRules.validate("my-studio");
            SlugRules.validate("my-team");
            SlugRules.validate("studio-1");
            SlugRules.validate("a1b");
            SlugRules.validate("a23456789012345678901234567890"); // 30 char (max)
        }
    }

    @Nested
    class InvalidFormat {
        @Test
        void rejects_too_short() {
            assertThatThrownBy(() -> SlugRules.validate("ab"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void rejects_too_long() {
            assertThatThrownBy(() -> SlugRules.validate("a23456789012345678901234567890123"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void rejects_uppercase() {
            assertThatThrownBy(() -> SlugRules.validate("MyTeam"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void rejects_starts_with_hyphen() {
            assertThatThrownBy(() -> SlugRules.validate("-balruno"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void rejects_special_chars() {
            assertThatThrownBy(() -> SlugRules.validate("balruno!"))
                    .isInstanceOf(WorkspaceException.class);
            assertThatThrownBy(() -> SlugRules.validate("bal_runo"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void rejects_null() {
            assertThatThrownBy(() -> SlugRules.validate(null))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void invalid_format_uses_SLUG_INVALID_reason() {
            try {
                SlugRules.validate("X");
            } catch (WorkspaceException e) {
                assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.SLUG_INVALID);
            }
        }
    }

    @Nested
    class Reserved {
        @Test
        void rejects_api() {
            assertThatThrownBy(() -> SlugRules.validate("api"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void rejects_app() {
            assertThatThrownBy(() -> SlugRules.validate("app"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void rejects_admin_www_balruno() {
            assertThatThrownBy(() -> SlugRules.validate("admin"))
                    .isInstanceOf(WorkspaceException.class);
            assertThatThrownBy(() -> SlugRules.validate("www"))
                    .isInstanceOf(WorkspaceException.class);
            assertThatThrownBy(() -> SlugRules.validate("balruno"))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void reserved_uses_SLUG_RESERVED_reason() {
            try {
                SlugRules.validate("api");
            } catch (WorkspaceException e) {
                assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.SLUG_RESERVED);
            }
        }
    }
}

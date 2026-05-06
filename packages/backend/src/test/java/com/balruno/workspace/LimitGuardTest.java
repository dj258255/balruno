// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure unit test for the guard's throw/no-throw decision. The behaviour
 * is small but load-bearing — every quota check across the codebase
 * funnels through here, so the boundary at {@code current >= limit} is
 * worth covering explicitly.
 */
class LimitGuardTest {

    private final LimitGuard guard = new LimitGuard();

    @Nested
    @DisplayName("Happy")
    class Happy {

        @Test
        void below_limit_passes_silently() {
            assertThatCode(() ->
                    guard.requireBelow(WorkspacePlan.FREE, "projectsPerWorkspace", 0, 3))
                    .doesNotThrowAnyException();
        }

        @Test
        void one_below_limit_passes() {
            // current=2, limit=3 → 3rd insert is allowed.
            assertThatCode(() ->
                    guard.requireBelow(WorkspacePlan.FREE, "projectsPerWorkspace", 2, 3))
                    .doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("Boundary")
    class Boundary {

        @Test
        void exactly_at_limit_throws() {
            // current=3, limit=3 → 4th insert is refused.
            assertThatThrownBy(() ->
                    guard.requireBelow(WorkspacePlan.FREE, "projectsPerWorkspace", 3, 3))
                    .isInstanceOfSatisfying(QuotaException.class, e -> {
                        assertThat(e.quotaKey()).isEqualTo("projectsPerWorkspace");
                        assertThat(e.current()).isEqualTo(3);
                        assertThat(e.limit()).isEqualTo(3);
                        assertThat(e.plan()).isEqualTo(WorkspacePlan.FREE);
                    });
        }

        @Test
        void one_above_limit_throws() {
            assertThatThrownBy(() ->
                    guard.requireBelow(WorkspacePlan.FREE, "projectsPerWorkspace", 4, 3))
                    .isInstanceOf(QuotaException.class);
        }

        @Test
        void zero_limit_throws_on_first_attempt() {
            // FREE.aiRequestsPerMonth = 0 — the *first* request must be refused.
            assertThatThrownBy(() ->
                    guard.requireBelow(WorkspacePlan.FREE, "aiRequestsPerMonth", 0, 0))
                    .isInstanceOfSatisfying(QuotaException.class, e ->
                            assertThat(e.quotaKey()).isEqualTo("aiRequestsPerMonth"));
        }
    }

    @Nested
    @DisplayName("Edge")
    class Edge {

        @Test
        void unlimited_sentinel_passes_at_huge_current() {
            // PRO/TEAM uses Integer.MAX_VALUE as "unlimited"; the guard
            // must never spuriously throw for high but legitimate counts.
            assertThatCode(() ->
                    guard.requireBelow(WorkspacePlan.PRO, "projectsPerWorkspace",
                            1_000_000, WorkspaceLimits.UNLIMITED))
                    .doesNotThrowAnyException();
        }

        @Test
        void exception_carries_plan_and_quota_key_for_problem_detail() {
            // ApiExceptionHandler reads these four fields verbatim into the
            // RFC 7807 ProblemDetail extensions; missing or mistyped values
            // would silently break the frontend's upgrade banner.
            assertThatThrownBy(() ->
                    guard.requireBelow(WorkspacePlan.PRO, "membersPerWorkspace", 10, 10))
                    .isInstanceOfSatisfying(QuotaException.class, e -> {
                        assertThat(e.quotaKey()).isEqualTo("membersPerWorkspace");
                        assertThat(e.current()).isEqualTo(10);
                        assertThat(e.limit()).isEqualTo(10);
                        assertThat(e.plan()).isEqualTo(WorkspacePlan.PRO);
                        assertThat(e.getMessage()).contains("PRO");
                        assertThat(e.getMessage()).contains("membersPerWorkspace");
                    });
        }
    }

    @Nested
    @DisplayName("Corner")
    class Corner {

        @Test
        void team_plan_with_unlimited_limit_never_throws_even_at_INT_MAX_minus_one() {
            // The "unlimited" sentinel is only safe if the guard does not
            // do strict-equality comparisons that would tip over at MAX-1.
            assertThatCode(() ->
                    guard.requireBelow(WorkspacePlan.TEAM, "projectsPerWorkspace",
                            Integer.MAX_VALUE - 1, WorkspaceLimits.UNLIMITED))
                    .doesNotThrowAnyException();
        }

        @Test
        void all_plans_use_consistent_limit_lookup() {
            // Sanity check that WorkspaceLimits.forPlan covers every enum value.
            for (var plan : WorkspacePlan.values()) {
                var limits = WorkspaceLimits.forPlan(plan);
                assertThat(limits).isNotNull();
                assertThat(limits.maxRowsPerSheet()).isPositive();
            }
        }
    }
}

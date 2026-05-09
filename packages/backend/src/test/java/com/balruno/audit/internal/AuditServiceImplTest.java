// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit.internal;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * AuditServiceImpl unit tests covering the limit-clamp behaviour.
 * Membership auth is the controller's job (ADR 0028 pattern); this
 * service trusts the caller has been authorised.
 */
@ExtendWith(MockitoExtension.class)
class AuditServiceImplTest {

    @Mock AuditRepository repo;
    @InjectMocks AuditServiceImpl service;

    @Nested
    @DisplayName("limit clamping")
    class LimitClamp {

        @Test
        void zero_or_negative_limit_clamps_to_1() {
            // Math.max(limit, 1) means 0/-50 both yield 1, not 100 like
            // HistoryServiceImpl. AuditService convention: minimum 1
            // since "give me 0 entries" is a degenerate request.
            var workspaceId = UUID.randomUUID();
            var cap = ArgumentCaptor.forClass(Limit.class);
            when(repo.findByWorkspaceIdOrderByIdDesc(any(), cap.capture())).thenReturn(List.of());

            service.listForWorkspace(UUID.randomUUID(), workspaceId, 0);
            assertThat(cap.getValue().max()).isEqualTo(1);

            service.listForWorkspace(UUID.randomUUID(), workspaceId, -100);
            assertThat(cap.getValue().max()).isEqualTo(1);
        }

        @Test
        void above_500_clamps_to_500() {
            var workspaceId = UUID.randomUUID();
            var cap = ArgumentCaptor.forClass(Limit.class);
            when(repo.findByWorkspaceIdOrderByIdDesc(any(), cap.capture())).thenReturn(List.of());

            service.listForWorkspace(UUID.randomUUID(), workspaceId, 9999);

            assertThat(cap.getValue().max()).isEqualTo(500);
        }

        @Test
        void mid_range_passes_through_unchanged() {
            var workspaceId = UUID.randomUUID();
            var cap = ArgumentCaptor.forClass(Limit.class);
            when(repo.findByWorkspaceIdOrderByIdDesc(any(), cap.capture())).thenReturn(List.of());

            service.listForWorkspace(UUID.randomUUID(), workspaceId, 50);

            assertThat(cap.getValue().max()).isEqualTo(50);
        }
    }

    @Nested
    @DisplayName("repo passthrough")
    class Passthrough {

        @Test
        void scope_ordered_query_invoked_with_workspace_id() {
            var workspaceId = UUID.randomUUID();
            when(repo.findByWorkspaceIdOrderByIdDesc(eq(workspaceId), any()))
                    .thenReturn(List.of());

            var result = service.listForWorkspace(UUID.randomUUID(), workspaceId, 100);

            assertThat(result).isNotNull();
        }
    }
}

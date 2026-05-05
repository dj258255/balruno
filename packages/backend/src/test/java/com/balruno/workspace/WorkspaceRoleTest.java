// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WorkspaceRoleTest {

    @Test
    void owner_permits_everything_below() {
        for (var lower : WorkspaceRole.values()) {
            assertThat(WorkspaceRole.OWNER.permits(lower)).isTrue();
        }
    }

    @Test
    void viewer_permits_only_viewer() {
        assertThat(WorkspaceRole.VIEWER.permits(WorkspaceRole.VIEWER)).isTrue();
        assertThat(WorkspaceRole.VIEWER.permits(WorkspaceRole.EDITOR)).isFalse();
        assertThat(WorkspaceRole.VIEWER.permits(WorkspaceRole.OWNER)).isFalse();
    }

    @Test
    void builder_permits_editor_and_viewer_but_not_admin() {
        assertThat(WorkspaceRole.BUILDER.permits(WorkspaceRole.EDITOR)).isTrue();
        assertThat(WorkspaceRole.BUILDER.permits(WorkspaceRole.VIEWER)).isTrue();
        assertThat(WorkspaceRole.BUILDER.permits(WorkspaceRole.BUILDER)).isTrue();
        assertThat(WorkspaceRole.BUILDER.permits(WorkspaceRole.ADMIN)).isFalse();
        assertThat(WorkspaceRole.BUILDER.permits(WorkspaceRole.OWNER)).isFalse();
    }

    @Test
    void editor_does_not_permit_builder_actions() {
        // ADR 0015 §3.2 — Builder = 구조 변경, Editor = 내용만.
        assertThat(WorkspaceRole.EDITOR.permits(WorkspaceRole.BUILDER)).isFalse();
    }
}

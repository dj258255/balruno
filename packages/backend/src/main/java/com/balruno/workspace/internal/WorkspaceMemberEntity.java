// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.WorkspaceRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.IdClass;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;

/**
 * Composite-key (workspace_id, user_id) row representing a user's role
 * within a workspace.
 */
@Entity
@Table(name = "workspace_members")
@IdClass(WorkspaceMemberEntity.WorkspaceMemberId.class)
class WorkspaceMemberEntity {

    @Id
    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "role", nullable = false, columnDefinition = "workspace_role")
    private WorkspaceRole role;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private OffsetDateTime joinedAt;

    protected WorkspaceMemberEntity() {}

    WorkspaceMemberEntity(UUID workspaceId, UUID userId, WorkspaceRole role) {
        this.workspaceId = workspaceId;
        this.userId = userId;
        this.role = role;
    }

    @PrePersist
    void onCreate() {
        this.joinedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getWorkspaceId() { return workspaceId; }
    public UUID getUserId() { return userId; }
    public WorkspaceRole getRole() { return role; }
    public OffsetDateTime getJoinedAt() { return joinedAt; }

    void changeRole(WorkspaceRole newRole) { this.role = newRole; }

    /** Composite key for {@code @IdClass}. JPA requires public no-arg + equals/hashCode. */
    public static class WorkspaceMemberId implements Serializable {
        private UUID workspaceId;
        private UUID userId;

        public WorkspaceMemberId() {}

        public WorkspaceMemberId(UUID workspaceId, UUID userId) {
            this.workspaceId = workspaceId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof WorkspaceMemberId other)) return false;
            return Objects.equals(workspaceId, other.workspaceId)
                    && Objects.equals(userId, other.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(workspaceId, userId);
        }
    }
}

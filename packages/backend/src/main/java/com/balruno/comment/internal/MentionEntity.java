// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * JPA mapping for mentions (V11) — the @-mention materialised view.
 *
 * Composite PK is (comment_id, mentioned_user). JPA models composite
 * keys via {@code @EmbeddedId} + a {@code @Embeddable} key class —
 * both fields appear in the PK class and are mirrored on the entity
 * via {@code @MapsId} or, simpler here, just by reading them off the
 * embedded id.
 */
@Entity
@Table(name = "mentions")
class MentionEntity {

    @EmbeddedId
    private MentionId id;

    @Column(name = "notified", nullable = false)
    private boolean notified;

    @Column(name = "notified_at")
    private OffsetDateTime notifiedAt;

    protected MentionEntity() {} // JPA

    MentionEntity(UUID commentId, UUID mentionedUser) {
        this.id = new MentionId(commentId, mentionedUser);
        this.notified = false;
    }

    @Embeddable
    static class MentionId implements Serializable {

        @Column(name = "comment_id", nullable = false)
        private UUID commentId;

        @Column(name = "mentioned_user", nullable = false)
        private UUID mentionedUser;

        protected MentionId() {} // JPA

        MentionId(UUID commentId, UUID mentionedUser) {
            this.commentId = commentId;
            this.mentionedUser = mentionedUser;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof MentionId other)) return false;
            return Objects.equals(commentId, other.commentId)
                && Objects.equals(mentionedUser, other.mentionedUser);
        }

        @Override
        public int hashCode() {
            return Objects.hash(commentId, mentionedUser);
        }
    }
}

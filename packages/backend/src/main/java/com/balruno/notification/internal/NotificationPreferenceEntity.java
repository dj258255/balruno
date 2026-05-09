// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.NotificationPreference;
import com.balruno.notification.NotificationPreference.DigestFrequency;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for user_notification_preferences (V17).
 *
 * The PK is the user id (1:1 with users table). updated_at is set
 * by the upsert path's native @Query (it always rewrites it on
 * conflict), so the entity reads it with @Generated and treats the
 * row as immutable from the JPA side — every preference change goes
 * through {@link NotificationPreferenceRepository#upsert}, never
 * through dirty-checking.
 */
@Entity
@Table(name = "user_notification_preferences")
class NotificationPreferenceEntity {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "email_on_mention", nullable = false)
    private boolean emailOnMention;

    @Column(name = "email_on_comment_reply", nullable = false)
    private boolean emailOnCommentReply;

    @Column(name = "push_on_mention", nullable = false)
    private boolean pushOnMention;

    @Column(name = "push_on_comment_reply", nullable = false)
    private boolean pushOnCommentReply;

    @Column(name = "digest_frequency", nullable = false)
    private String digestFrequency;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    protected NotificationPreferenceEntity() {} // JPA

    NotificationPreference toDto() {
        return new NotificationPreference(
                userId, emailOnMention, emailOnCommentReply,
                pushOnMention, pushOnCommentReply,
                DigestFrequency.parse(digestFrequency),
                updatedAt);
    }
}

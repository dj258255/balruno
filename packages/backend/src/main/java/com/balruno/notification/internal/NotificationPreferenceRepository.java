// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

/**
 * Persistence for user_notification_preferences.
 *
 * Upsert path is native — JPA's stock save() doesn't expose
 * UPSERT semantics, and the conflict key happens to be the
 * primary key (user_id) which would also confuse a save() into
 * thinking it's an update.
 */
interface NotificationPreferenceRepository extends JpaRepository<NotificationPreferenceEntity, UUID> {

    @Modifying
    @Query(value = """
                   INSERT INTO user_notification_preferences (
                       user_id, email_on_mention, email_on_comment_reply,
                       push_on_mention, push_on_comment_reply,
                       digest_frequency, updated_at)
                   VALUES (:userId, :emailMention, :emailReply,
                           :pushMention, :pushReply,
                           :digest, now())
                   ON CONFLICT (user_id) DO UPDATE SET
                       email_on_mention = EXCLUDED.email_on_mention,
                       email_on_comment_reply = EXCLUDED.email_on_comment_reply,
                       push_on_mention = EXCLUDED.push_on_mention,
                       push_on_comment_reply = EXCLUDED.push_on_comment_reply,
                       digest_frequency = EXCLUDED.digest_frequency,
                       updated_at = now()
                   """,
           nativeQuery = true)
    int upsert(@Param("userId") UUID userId,
               @Param("emailMention") boolean emailOnMention,
               @Param("emailReply") boolean emailOnCommentReply,
               @Param("pushMention") boolean pushOnMention,
               @Param("pushReply") boolean pushOnCommentReply,
               @Param("digest") String digestFrequency);

    /**
     * Used by the digest scheduler — find users on a given cadence
     * who still have at least one email channel on. Filtering on
     * (email_on_mention OR email_on_comment_reply) at the DB level
     * keeps the digest job from waking up users who only want push.
     */
    @Query(value = """
                   SELECT user_id FROM user_notification_preferences
                    WHERE digest_frequency = :cadence
                      AND (email_on_mention OR email_on_comment_reply)
                   """,
           nativeQuery = true)
    List<UUID> findUsersForDigest(@Param("cadence") String cadence);
}

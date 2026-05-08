// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.NotificationPreference;
import com.balruno.notification.NotificationPreference.DigestFrequency;
import com.balruno.notification.WebPushSubscription;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
class NotificationRepository {

    private final JdbcTemplate jdbc;

    NotificationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static OffsetDateTime ts(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant().atOffset(ZoneOffset.UTC);
    }

    private static final RowMapper<NotificationPreference> PREF = (rs, i) -> new NotificationPreference(
            rs.getObject("user_id", UUID.class),
            rs.getBoolean("email_on_mention"),
            rs.getBoolean("email_on_comment_reply"),
            rs.getBoolean("push_on_mention"),
            rs.getBoolean("push_on_comment_reply"),
            DigestFrequency.parse(rs.getString("digest_frequency")),
            ts(rs, "updated_at")
    );

    private static final RowMapper<WebPushSubscription> SUB = (rs, i) -> new WebPushSubscription(
            rs.getObject("id", UUID.class),
            rs.getObject("user_id", UUID.class),
            rs.getString("endpoint"),
            rs.getString("p256dh"),
            rs.getString("auth"),
            rs.getString("user_agent"),
            ts(rs, "created_at"),
            ts(rs, "last_used_at")
    );

    /** Returns null when the user hasn't customised preferences yet —
     *  the service layer fills in defaults. */
    NotificationPreference findPreference(UUID userId) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT user_id, email_on_mention, email_on_comment_reply,
                           push_on_mention, push_on_comment_reply,
                           digest_frequency, updated_at
                    FROM user_notification_preferences
                    WHERE user_id = ?
                    """,
                    PREF, userId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    NotificationPreference upsertPreference(NotificationPreference pref) {
        return jdbc.queryForObject(
                """
                INSERT INTO user_notification_preferences (
                    user_id, email_on_mention, email_on_comment_reply,
                    push_on_mention, push_on_comment_reply,
                    digest_frequency, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    email_on_mention = EXCLUDED.email_on_mention,
                    email_on_comment_reply = EXCLUDED.email_on_comment_reply,
                    push_on_mention = EXCLUDED.push_on_mention,
                    push_on_comment_reply = EXCLUDED.push_on_comment_reply,
                    digest_frequency = EXCLUDED.digest_frequency,
                    updated_at = now()
                RETURNING user_id, email_on_mention, email_on_comment_reply,
                          push_on_mention, push_on_comment_reply,
                          digest_frequency, updated_at
                """,
                PREF,
                pref.userId(),
                pref.emailOnMention(),
                pref.emailOnCommentReply(),
                pref.pushOnMention(),
                pref.pushOnCommentReply(),
                pref.digestFrequency().wireValue());
    }

    WebPushSubscription upsertSubscription(UUID userId, String endpoint, String p256dh,
                                           String auth, String userAgent) {
        return jdbc.queryForObject(
                """
                INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id, endpoint) DO UPDATE SET
                    p256dh = EXCLUDED.p256dh,
                    auth = EXCLUDED.auth,
                    user_agent = EXCLUDED.user_agent
                RETURNING id, user_id, endpoint, p256dh, auth, user_agent,
                          created_at, last_used_at
                """,
                SUB,
                userId, endpoint, p256dh, auth, userAgent);
    }

    List<WebPushSubscription> listSubscriptions(UUID userId) {
        return jdbc.query(
                """
                SELECT id, user_id, endpoint, p256dh, auth, user_agent,
                       created_at, last_used_at
                FROM web_push_subscriptions
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
                SUB, userId);
    }

    int deleteSubscription(UUID userId, UUID subscriptionId) {
        return jdbc.update(
                "DELETE FROM web_push_subscriptions WHERE id = ? AND user_id = ?",
                subscriptionId, userId);
    }

    /** Subscription expired or revoked by the browser — push gateway
     *  returned 410 Gone. We delete the row so future fanouts skip it. */
    int deleteByEndpoint(String endpoint) {
        return jdbc.update(
                "DELETE FROM web_push_subscriptions WHERE endpoint = ?",
                endpoint);
    }

    void touchLastUsed(UUID id, OffsetDateTime now) {
        try {
            jdbc.update(
                    "UPDATE web_push_subscriptions SET last_used_at = ? WHERE id = ?",
                    Timestamp.from(now.toInstant()), id);
        } catch (Exception ignored) {
            // Diagnostic; never block delivery on the touch.
        }
    }

    /** Used by the digest job — find users who want digest emails on
     *  the given cadence. Filtering on email_on_mention because at
     *  least one event channel must be on for the digest to have
     *  content. */
    List<UUID> findUsersForDigest(String cadence) {
        return jdbc.queryForList(
                """
                SELECT user_id FROM user_notification_preferences
                WHERE digest_frequency = ?
                  AND (email_on_mention OR email_on_comment_reply)
                """,
                UUID.class, cadence);
    }
}

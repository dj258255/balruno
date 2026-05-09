// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.NotificationPreference;
import com.balruno.notification.NotificationPreference.DigestFrequency;
import com.balruno.notification.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NotificationServiceImpl unit tests covering preference defaults +
 * partial-update merging + subscription lifecycle.
 *
 * The real DigestFrequency.parse + DEFAULT constant are used (pure
 * data) so the suite verifies the actual partial-update merge that
 * production runs.
 */
@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock NotificationPreferenceRepository prefs;
    @Mock WebPushSubscriptionRepository subs;
    @Mock WebPushDispatcher pushDispatcher;
    @InjectMocks NotificationServiceImpl service;

    @Nested
    @DisplayName("getPreference")
    class Get {

        @Test
        void unknown_user_returns_default_preference() {
            // First-time visitors haven't customised — return the
            // baked-in default rather than 404. Email + push channels
            // for mention + reply, INSTANT digest.
            var userId = UUID.randomUUID();
            when(prefs.findById(eq(userId))).thenReturn(Optional.empty());

            var result = service.getPreference(userId);

            assertThat(result.userId()).isEqualTo(userId);
            assertThat(result.emailOnMention()).isTrue();
            assertThat(result.emailOnCommentReply()).isTrue();
            assertThat(result.pushOnMention()).isTrue();
            assertThat(result.pushOnCommentReply()).isFalse();
            assertThat(result.digestFrequency()).isEqualTo(DigestFrequency.INSTANT);
        }

        @Test
        void existing_user_returns_persisted_values() {
            var userId = UUID.randomUUID();
            var entity = preferenceEntity(userId, false, false, false, true,
                    DigestFrequency.DAILY);
            when(prefs.findById(eq(userId))).thenReturn(Optional.of(entity));

            var result = service.getPreference(userId);

            assertThat(result.emailOnMention()).isFalse();
            assertThat(result.pushOnCommentReply()).isTrue();
            assertThat(result.digestFrequency()).isEqualTo(DigestFrequency.DAILY);
        }
    }

    @Nested
    @DisplayName("updatePreference")
    class Update {

        @Test
        void partial_update_merges_with_existing_values() {
            // User toggles only emailOnMention; the other 4 fields must
            // come from the existing row, not the DEFAULT constant.
            var userId = UUID.randomUUID();
            var existing = preferenceEntity(userId, true, true, true, true,
                    DigestFrequency.WEEKLY);
            when(prefs.findById(eq(userId)))
                    .thenReturn(Optional.of(existing))
                    .thenReturn(Optional.of(preferenceEntity(userId, false, true, true, true,
                            DigestFrequency.WEEKLY)));

            service.updatePreference(userId, new NotificationService.UpdatePreferenceInput(
                    false, null, null, null, null));

            // Verify upsert receives the merged row: only emailOnMention=false,
            // others retain existing values.
            verify(prefs).upsert(eq(userId),
                    eq(false), eq(true), eq(true), eq(true),
                    eq(DigestFrequency.WEEKLY.wireValue()));
        }

        @Test
        void digest_frequency_string_parses_through_input() {
            var userId = UUID.randomUUID();
            var existing = preferenceEntity(userId, true, true, true, false,
                    DigestFrequency.INSTANT);
            when(prefs.findById(eq(userId)))
                    .thenReturn(Optional.of(existing))
                    .thenReturn(Optional.of(preferenceEntity(userId, true, true, true, false,
                            DigestFrequency.DAILY)));

            service.updatePreference(userId, new NotificationService.UpdatePreferenceInput(
                    null, null, null, null, "DAILY"));

            verify(prefs).upsert(any(), anyBoolean(), anyBoolean(),
                    anyBoolean(), anyBoolean(),
                    eq(DigestFrequency.DAILY.wireValue()));
        }
    }

    @Nested
    @DisplayName("subscriptions")
    class Subs {

        @Test
        void delete_subscription_scoped_to_owner() {
            // Delete must include the user id in WHERE so a malicious
            // client can't pass another user's subscription id and
            // wipe their browser registration.
            var userId = UUID.randomUUID();
            var subId = UUID.randomUUID();

            service.deleteSubscription(userId, subId);

            verify(subs).deleteByIdAndUserId(eq(subId), eq(userId));
        }

        @Test
        void listSubscriptions_returns_empty_when_none() {
            when(subs.findByUserIdOrderByCreatedAtDesc(any())).thenReturn(List.of());
            assertThat(service.listSubscriptions(UUID.randomUUID())).isEmpty();
        }

        @Test
        void vapid_public_key_delegates_to_dispatcher() {
            when(pushDispatcher.publicKey()).thenReturn("BVA...");
            assertThat(service.vapidPublicKey()).isEqualTo("BVA...");
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private static NotificationPreferenceEntity preferenceEntity(
            UUID userId, boolean emailOnMention, boolean emailOnCommentReply,
            boolean pushOnMention, boolean pushOnCommentReply, DigestFrequency dig) {
        try {
            var entity = new NotificationPreferenceEntity();
            setField(entity, "userId", userId);
            setField(entity, "emailOnMention", emailOnMention);
            setField(entity, "emailOnCommentReply", emailOnCommentReply);
            setField(entity, "pushOnMention", pushOnMention);
            setField(entity, "pushOnCommentReply", pushOnCommentReply);
            setField(entity, "digestFrequency", dig.wireValue());
            setField(entity, "updatedAt", OffsetDateTime.now());
            return entity;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void setField(Object o, String field, Object val) throws Exception {
        var f = o.getClass().getDeclaredField(field);
        f.setAccessible(true);
        f.set(o, val);
    }
}

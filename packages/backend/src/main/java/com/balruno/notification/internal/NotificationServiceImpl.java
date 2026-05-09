// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.NotificationPreference;
import com.balruno.notification.NotificationPreference.DigestFrequency;
import com.balruno.notification.NotificationService;
import com.balruno.notification.WebPushSubscription;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
class NotificationServiceImpl implements NotificationService {

    static final NotificationPreference DEFAULT = new NotificationPreference(
            null, true, true, true, false,
            DigestFrequency.INSTANT, null);

    private final NotificationPreferenceRepository prefs;
    private final WebPushSubscriptionRepository subs;
    private final WebPushDispatcher pushDispatcher;

    NotificationServiceImpl(NotificationPreferenceRepository prefs,
                             WebPushSubscriptionRepository subs,
                             WebPushDispatcher pushDispatcher) {
        this.prefs = prefs;
        this.subs = subs;
        this.pushDispatcher = pushDispatcher;
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationPreference getPreference(UUID userId) {
        var existing = prefs.findById(userId).map(NotificationPreferenceEntity::toDto).orElse(null);
        if (existing != null) return existing;
        return new NotificationPreference(
                userId,
                DEFAULT.emailOnMention(),
                DEFAULT.emailOnCommentReply(),
                DEFAULT.pushOnMention(),
                DEFAULT.pushOnCommentReply(),
                DEFAULT.digestFrequency(),
                null);
    }

    @Override
    @Transactional
    public NotificationPreference updatePreference(UUID userId, UpdatePreferenceInput input) {
        var current = getPreference(userId);
        var nextDigest = input.digestFrequency() != null
                ? DigestFrequency.parse(input.digestFrequency())
                : current.digestFrequency();
        prefs.upsert(
                userId,
                input.emailOnMention() != null ? input.emailOnMention() : current.emailOnMention(),
                input.emailOnCommentReply() != null ? input.emailOnCommentReply() : current.emailOnCommentReply(),
                input.pushOnMention() != null ? input.pushOnMention() : current.pushOnMention(),
                input.pushOnCommentReply() != null ? input.pushOnCommentReply() : current.pushOnCommentReply(),
                nextDigest.wireValue());
        return prefs.findById(userId).map(NotificationPreferenceEntity::toDto)
                .orElseThrow(() -> new IllegalStateException("upsert succeeded but row missing"));
    }

    @Override
    @Transactional
    public WebPushSubscription saveSubscription(UUID userId, SaveSubscriptionInput input) {
        subs.upsert(
                userId,
                input.endpoint(),
                input.p256dh(),
                input.auth(),
                input.userAgent());
        return subs.findByUserIdAndEndpoint(userId, input.endpoint())
                .map(WebPushSubscriptionEntity::toDto)
                .orElseThrow(() -> new IllegalStateException("upsert succeeded but row missing"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<WebPushSubscription> listSubscriptions(UUID userId) {
        return subs.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(WebPushSubscriptionEntity::toDto)
                .toList();
    }

    @Override
    @Transactional
    public void deleteSubscription(UUID userId, UUID subscriptionId) {
        subs.deleteByIdAndUserId(subscriptionId, userId);
    }

    @Override
    public String vapidPublicKey() {
        return pushDispatcher.publicKey();
    }
}

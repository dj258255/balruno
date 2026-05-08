// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.notification.NotificationPreference;
import com.balruno.notification.NotificationPreference.DigestFrequency;
import com.balruno.notification.NotificationService;
import com.balruno.notification.WebPushSubscription;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
class NotificationServiceImpl implements NotificationService {

    static final NotificationPreference DEFAULT = new NotificationPreference(
            null, true, true, true, false,
            DigestFrequency.INSTANT, null);

    private final NotificationRepository repo;
    private final WebPushDispatcher pushDispatcher;

    NotificationServiceImpl(NotificationRepository repo, WebPushDispatcher pushDispatcher) {
        this.repo = repo;
        this.pushDispatcher = pushDispatcher;
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationPreference getPreference(UUID userId) {
        var existing = repo.findPreference(userId);
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
        var next = new NotificationPreference(
                userId,
                input.emailOnMention() != null ? input.emailOnMention() : current.emailOnMention(),
                input.emailOnCommentReply() != null ? input.emailOnCommentReply() : current.emailOnCommentReply(),
                input.pushOnMention() != null ? input.pushOnMention() : current.pushOnMention(),
                input.pushOnCommentReply() != null ? input.pushOnCommentReply() : current.pushOnCommentReply(),
                input.digestFrequency() != null
                        ? DigestFrequency.parse(input.digestFrequency())
                        : current.digestFrequency(),
                OffsetDateTime.now());
        return repo.upsertPreference(next);
    }

    @Override
    @Transactional
    public WebPushSubscription saveSubscription(UUID userId, SaveSubscriptionInput input) {
        return repo.upsertSubscription(
                userId,
                input.endpoint(),
                input.p256dh(),
                input.auth(),
                input.userAgent());
    }

    @Override
    @Transactional(readOnly = true)
    public List<WebPushSubscription> listSubscriptions(UUID userId) {
        return repo.listSubscriptions(userId);
    }

    @Override
    @Transactional
    public void deleteSubscription(UUID userId, UUID subscriptionId) {
        repo.deleteSubscription(userId, subscriptionId);
    }

    @Override
    public String vapidPublicKey() {
        return pushDispatcher.publicKey();
    }
}

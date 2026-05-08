// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.events.MentionCreatedEvent;
import com.balruno.notification.NotificationPreference.DigestFrequency;
import com.balruno.user.UserDirectoryService;
import com.balruno.user.UserBrief;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Component;


/**
 * Listens for {@link MentionCreatedEvent} and fans out via the
 * configured channels — email + Web Push — based on the recipient's
 * {@code user_notification_preferences}.
 *
 * Decoupled from the publisher (comment module) via Spring's
 * ApplicationEvent bus — no static dep cycle. Same pattern as
 * webhook outbound (ADR 0028).
 */
@Component
@EnableAsync
class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final NotificationRepository repo;
    private final WebPushDispatcher pushDispatcher;

    /** Optional — null when SMTP isn't configured (the bean only
     *  exists when {@code spring.mail.host} is set). */
    private final ObjectProvider<EmailService> emailServiceProvider;

    private final UserDirectoryService users;

    private final ObjectMapper jsonMapper = new ObjectMapper();

    NotificationDispatcher(NotificationRepository repo,
                           WebPushDispatcher pushDispatcher,
                           ObjectProvider<EmailService> emailServiceProvider,
                           UserDirectoryService users) {
        this.repo = repo;
        this.pushDispatcher = pushDispatcher;
        this.emailServiceProvider = emailServiceProvider;
        this.users = users;
    }

    @EventListener
    @Async
    public void onMention(MentionCreatedEvent event) {
        try {
            dispatch(event);
        } catch (Exception e) {
            log.warn("notification dispatch failed mentionedUser={}: {}",
                    event.mentionedUserId(), e.getMessage());
        }
    }

    private void dispatch(MentionCreatedEvent event) {
        // Don't notify the author about their own mention. Common
        // user error in tests but a real footgun in collaboration.
        if (event.authorUserId().equals(event.mentionedUserId())) return;

        // Single batch UserBrief lookup — covers both author + recipient.
        var briefs = users.findBriefsByIds(java.util.List.of(
                event.authorUserId(), event.mentionedUserId()));
        var author = briefs.get(event.authorUserId());
        var recipient = briefs.get(event.mentionedUserId());
        if (recipient == null || recipient.email() == null) {
            // No way to email them; push channel still works if subs exist.
        }

        var pref = repo.findPreference(event.mentionedUserId());
        boolean emailOn = pref == null
                ? NotificationServiceImpl.DEFAULT.emailOnMention()
                : pref.emailOnMention();
        boolean pushOn = pref == null
                ? NotificationServiceImpl.DEFAULT.pushOnMention()
                : pref.pushOnMention();
        var freq = pref == null
                ? NotificationServiceImpl.DEFAULT.digestFrequency()
                : pref.digestFrequency();

        var snippet = trim(event.commentBodyPlainText(), 200);
        var authorName = nameOf(author);
        var projectName = "Balruno"; // project name lookup deferred — keeps the dispatcher
                                     // off the project module's static dep.

        // Email — only the 'instant' cadence sends per-event mail.
        // 'daily' / 'weekly' aggregate via a Spring @Scheduled digest
        // job (lands as a follow-up); 'off' suppresses entirely.
        if (emailOn && freq == DigestFrequency.INSTANT
                && recipient != null && recipient.email() != null) {
            var emailService = emailServiceProvider.getIfAvailable();
            if (emailService != null) {
                emailService.sendMentionEmail(
                        recipient.email(), authorName, projectName, snippet,
                        "https://balruno.com/inbox");
            }
        }

        // Web Push — fan out to every subscribed device.
        if (pushOn && pushDispatcher.isReady()) {
            var payload = pushPayload(authorName, projectName, snippet);
            for (var sub : repo.listSubscriptions(event.mentionedUserId())) {
                pushDispatcher.send(sub, payload);
            }
        }
    }

    private static String nameOf(UserBrief brief) {
        if (brief == null) return "Someone";
        if (brief.name() != null && !brief.name().isBlank()) return brief.name();
        if (brief.email() != null) return brief.email();
        return "Someone";
    }

    private String pushPayload(String author, String project, String snippet) {
        try {
            var node = jsonMapper.createObjectNode();
            node.put("title", String.format("%s mentioned you", author));
            node.put("body", snippet);
            node.put("url", "https://balruno.com/inbox");
            node.put("icon", "/icon-192.png");
            return jsonMapper.writeValueAsString(node);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}

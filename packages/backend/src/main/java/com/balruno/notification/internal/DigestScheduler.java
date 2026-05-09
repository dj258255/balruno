// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import com.balruno.comment.Comment;
import com.balruno.comment.CommentService;
import com.balruno.user.UserDirectoryService;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;

/**
 * Daily / weekly digest scheduler (ADR 0024 Stage I).
 *
 * Users who picked {@code digest_frequency = 'daily'} or
 * {@code 'weekly'} get one email containing all mentions in the
 * window — instead of an email per mention. Notion / Linear
 * "weekly summary" pattern.
 *
 * The crons run at midnight UTC. Daily fires every day; weekly on
 * Mondays. Both look back the matching window and aggregate.
 *
 * The whole bean is conditional on {@link EmailService} being
 * present — when SMTP isn't configured, the scheduler still loads
 * but {@code emailServiceProvider.getIfAvailable()} returns null
 * and the run skips.
 */
@Component
class DigestScheduler {

    private static final Logger log = LoggerFactory.getLogger(DigestScheduler.class);

    private final NotificationPreferenceRepository prefs;
    private final ObjectProvider<EmailService> emailServiceProvider;
    private final CommentService comments;
    private final UserDirectoryService users;

    DigestScheduler(NotificationPreferenceRepository prefs,
                    ObjectProvider<EmailService> emailServiceProvider,
                    CommentService comments,
                    UserDirectoryService users) {
        this.prefs = prefs;
        this.emailServiceProvider = emailServiceProvider;
        this.comments = comments;
        this.users = users;
    }

    /** Daily at 00:00 UTC. */
    @Scheduled(cron = "0 0 0 * * *", zone = "UTC")
    void runDailyDigest() {
        runDigest("daily", "Daily", Duration.ofDays(1));
    }

    /** Weekly Monday at 00:00 UTC. */
    @Scheduled(cron = "0 0 0 * * MON", zone = "UTC")
    void runWeeklyDigest() {
        runDigest("weekly", "Weekly", Duration.ofDays(7));
    }

    private void runDigest(String cadence, String cadenceLabel, Duration window) {
        var emailService = emailServiceProvider.getIfAvailable();
        if (emailService == null) {
            log.debug("digest skipped — SMTP not configured");
            return;
        }
        var since = OffsetDateTime.now().minus(window);
        var userIds = prefs.findUsersForDigest(cadence);
        if (userIds.isEmpty()) {
            log.debug("digest cadence={} userCount=0", cadence);
            return;
        }
        var briefs = users.findBriefsByIds(userIds);
        int sent = 0;
        for (var userId : userIds) {
            var mentions = comments.listMentionsSinceForUser(userId, since);
            if (mentions.isEmpty()) continue;
            var brief = briefs.get(userId);
            if (brief == null || brief.email() == null) continue;
            var items = renderItems(mentions, briefs);
            try {
                emailService.sendDigestEmail(brief.email(), cadenceLabel, items);
                sent++;
            } catch (Exception e) {
                log.warn("digest send failed userId={}: {}", userId, e.getMessage());
            }
        }
        log.info("digest run cadence={} subscribers={} sent={}", cadence, userIds.size(), sent);
    }

    private java.util.List<EmailService.DigestItem> renderItems(
            java.util.List<Comment> mentions,
            java.util.Map<java.util.UUID, com.balruno.user.UserBrief> briefs) {
        var out = new ArrayList<EmailService.DigestItem>(mentions.size());
        for (var c : mentions) {
            var author = briefs.get(c.authorUserId());
            var name = author != null && author.name() != null
                    ? author.name() : "Someone";
            out.add(new EmailService.DigestItem(
                    name,
                    extractSnippet(c.bodyJson(), 200),
                    "https://balruno.com/inbox",
                    c.createdAt() != null ? c.createdAt().toLocalDate().toString() : ""));
        }
        return out;
    }

    /** Tiptap doc → plain text. Same logic as the comment module's
     *  MentionExtractor.flatten but keeping it local so the scheduler
     *  doesn't reach into another module's package-private internals. */
    private static String extractSnippet(JsonNode body, int max) {
        var sb = new StringBuilder();
        walk(body, sb);
        var s = sb.toString().trim();
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private static void walk(JsonNode node, StringBuilder out) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            var type = node.get("type");
            if (type != null && "text".equals(type.asText())) {
                var text = node.get("text");
                if (text != null && !text.isNull()) {
                    out.append(text.asText()).append(' ');
                }
            }
            var content = node.get("content");
            if (content != null && content.isArray()) {
                for (var child : content) walk(child, out);
            }
        } else if (node.isArray()) {
            for (var child : node) walk(child, out);
        }
    }
}

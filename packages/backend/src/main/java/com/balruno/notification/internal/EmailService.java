// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.notification.internal;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * SMTP delivery wrapper. Spring's JavaMailSender is auto-configured
 * from the standard {@code spring.mail.*} properties — admin brings
 * their own SMTP host (Resend / Brevo / Gmail App Password / their
 * own MTA). Same pattern as Outline / AFFiNE / Baserow — no built-in
 * delivery service.
 *
 * The whole bean is conditional on {@code spring.mail.host} being
 * set; when self-hosters haven't configured SMTP yet, the listener
 * gracefully no-ops the email channel (push still works).
 */
@Service
@ConditionalOnProperty(name = "spring.mail.host")
class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailer;
    private final String fromAddress;
    private final String fromName;

    EmailService(
            JavaMailSender mailer,
            @Value("${balruno.notification.email.from-address:noreply@balruno.com}") String fromAddress,
            @Value("${balruno.notification.email.from-name:Balruno}") String fromName) {
        this.mailer = mailer;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
    }

    /**
     * Send a daily / weekly digest aggregating multiple mentions
     * into one email (ADR 0024 Stage I, digest cadence).
     *
     * Items are pre-rendered tuples (author / snippet / link) so
     * the caller can keep the body off this service's import graph.
     */
    void sendDigestEmail(String toAddress, String cadenceLabel, java.util.List<DigestItem> items) {
        if (items.isEmpty()) return;
        try {
            MimeMessage msg = mailer.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(toAddress);
            helper.setSubject(String.format("[Balruno] %s digest — %d mentions",
                    cadenceLabel, items.size()));
            helper.setText(buildDigestHtml(cadenceLabel, items), true);
            mailer.send(msg);
        } catch (Exception e) {
            log.warn("digest email send failed to={}: {}", toAddress, e.getMessage());
        }
    }

    record DigestItem(String authorName, String snippet, String deepLink, String createdAt) {}

    private static String buildDigestHtml(String cadence, java.util.List<DigestItem> items) {
        var sb = new StringBuilder();
        sb.append("<!doctype html><html><body style=\"font-family:system-ui,-apple-system,sans-serif;color:#1f2937;max-width:560px;margin:24px auto;padding:0 16px\">");
        sb.append("<p style=\"font-size:14px;color:#6b7280;margin:0 0 8px\">Balruno · ")
          .append(escape(cadence)).append(" digest</p>");
        sb.append("<h2 style=\"font-size:18px;margin:0 0 16px\">")
          .append(items.size()).append(" mention")
          .append(items.size() == 1 ? "" : "s").append("</h2>");
        sb.append("<ul style=\"list-style:none;padding:0;margin:0\">");
        for (var item : items) {
            sb.append("<li style=\"border-left:3px solid #e5e7eb;padding:8px 12px;margin:0 0 12px\">")
              .append("<p style=\"margin:0 0 4px;font-size:13px;color:#374151\"><strong>")
              .append(escape(item.authorName())).append("</strong> · ")
              .append("<span style=\"color:#9ca3af\">").append(escape(item.createdAt())).append("</span></p>")
              .append("<p style=\"margin:0 0 4px;font-size:14px;color:#1f2937\">")
              .append(escape(item.snippet())).append("</p>")
              .append("<a href=\"").append(escape(item.deepLink()))
              .append("\" style=\"color:#3b82f6;font-size:12px;text-decoration:none\">View →</a>")
              .append("</li>");
        }
        sb.append("</ul>");
        sb.append("<p style=\"font-size:12px;color:#9ca3af;margin-top:24px\">")
          .append("Notification preferences: <a href=\"https://balruno.com/settings/notifications\" style=\"color:#6b7280\">manage</a>")
          .append("</p>");
        sb.append("</body></html>");
        return sb.toString();
    }

    void sendMentionEmail(String toAddress, String authorName, String projectName,
                          String snippet, String deepLink) {
        try {
            MimeMessage msg = mailer.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(toAddress);
            helper.setSubject(String.format("[%s] %s mentioned you", projectName, authorName));
            helper.setText(buildHtml(authorName, projectName, snippet, deepLink), true);
            mailer.send(msg);
        } catch (MessagingException | java.io.UnsupportedEncodingException e) {
            log.warn("mention email send failed to={}: {}", toAddress, e.getMessage());
        } catch (Exception e) {
            log.warn("mention email send unexpected error to={}: {}", toAddress, e.getMessage());
        }
    }

    private static String buildHtml(String author, String project, String snippet, String link) {
        // Keep the markup minimal — every rendering quirk in old
        // mail clients is a battle we're not fighting at v1.
        return """
            <!doctype html>
            <html><body style="font-family:system-ui,-apple-system,sans-serif;color:#1f2937;max-width:560px;margin:24px auto;padding:0 16px">
                <p style="font-size:14px;color:#6b7280;margin:0 0 8px">Balruno · %s</p>
                <h2 style="font-size:18px;margin:0 0 12px">%s mentioned you</h2>
                <blockquote style="border-left:3px solid #e5e7eb;padding:8px 12px;margin:0 0 16px;color:#374151;font-size:14px">%s</blockquote>
                <p><a href="%s" style="display:inline-block;padding:8px 16px;background:#111827;color:#fff;border-radius:6px;text-decoration:none;font-size:14px">View comment</a></p>
                <p style="font-size:12px;color:#9ca3af;margin-top:24px">
                    Notification preferences: <a href="%s/settings/notifications" style="color:#6b7280">manage</a>
                </p>
            </body></html>
            """.formatted(escape(project), escape(author), escape(snippet), escape(link), escape(link));
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook.internal;

import com.balruno.events.WebhookEvent;
import com.balruno.webhook.WebhookService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Bridges {@link WebhookEvent}s into {@link WebhookService#publish}.
 *
 * Lives inside the webhook module so the publisher modules don't
 * need a compile-time dep on this module — they just emit the
 * event, Spring routes it here.
 */
@Component
class WebhookEventListener {

    private final WebhookService webhooks;

    WebhookEventListener(WebhookService webhooks) {
        this.webhooks = webhooks;
    }

    @EventListener
    public void onWebhookEvent(WebhookEvent event) {
        webhooks.publish(event.projectId(), event.event(), event.payload());
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

/**
 * Fired when a user's avatar URL changes (PATCH /api/v1/me with a
 * new {@code avatarUrl}, or GDPR delete clearing the avatar).
 *
 * Storage module listens and best-effort deletes the previous
 * {@code /media/avatars/...} blob so a user uploading 100 different
 * pictures doesn't leak 100 R2 objects.
 *
 * Decoupled via this event so the user module doesn't need a static
 * dep on storage (Spring Modulith arch test rejects user → storage
 * because storage already depends on project, which depends on user
 * via UserCreatedEvent — the cycle would close).
 */
public record AvatarReplacedEvent(
        /** /media/avatars/{userId}/{hash}.{ext} of the OLD avatar. */
        String previousMediaPath
) {}

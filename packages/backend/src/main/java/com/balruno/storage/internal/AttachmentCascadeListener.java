// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.events.AvatarReplacedEvent;
import com.balruno.events.ProjectSoftDeletedEvent;
import com.balruno.storage.StorageService;
import com.balruno.storage.WorkspaceStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Cascade hook from project soft-delete → R2 attachment cleanup +
 * workspace storage counter decrement.
 *
 * Decoupled via ApplicationEvent so the project module doesn't get
 * a static dep on storage (Spring Modulith arch test). The
 * publisher (ProjectServiceImpl.softDelete) emits afterCommit so
 * a rolled-back DB transaction can't trigger the blob delete.
 *
 * Failure handling: orphan blobs after a partial cascade are
 * benign — a future R2 lifecycle rule plus reconciliation cron
 * will sweep them. We log the error and let the listener return
 * cleanly so the surrounding HTTP request still 200s.
 */
@Component
class AttachmentCascadeListener {

    private static final Logger log = LoggerFactory.getLogger(AttachmentCascadeListener.class);

    private final StorageService storage;
    private final WorkspaceStorageService workspaceStorage;

    AttachmentCascadeListener(StorageService storage, WorkspaceStorageService workspaceStorage) {
        this.storage = storage;
        this.workspaceStorage = workspaceStorage;
    }

    @EventListener
    public void onProjectSoftDeleted(ProjectSoftDeletedEvent event) {
        var prefix = "attachments/" + event.projectId() + "/";
        try {
            var bytesDeleted = storage.deleteByPrefix(prefix);
            if (bytesDeleted > 0) {
                workspaceStorage.decrement(event.workspaceId(), bytesDeleted);
            }
            log.info("project_soft_delete cascade — projectId={} bytes_freed={}",
                    event.projectId(), bytesDeleted);
        } catch (Exception e) {
            log.error("project_soft_delete cascade failed — projectId={} prefix={}",
                    event.projectId(), prefix, e);
        }
    }

    /**
     * Avatar orphan cleanup. The user module emits this on PATCH
     * /me when the avatarUrl changes, and on GDPR account-delete
     * with the per-user prefix. We accept both shapes:
     *   - "avatars/{userId}/{hash}.{ext}" — single-blob delete
     *   - "avatars/{userId}/"             — full per-user wipe
     */
    @EventListener
    public void onAvatarReplaced(AvatarReplacedEvent event) {
        var path = event.previousMediaPath();
        if (path == null || path.isBlank()) return;
        try {
            if (path.endsWith("/")) {
                storage.deleteByPrefix(path);
            } else {
                storage.delete(path);
            }
        } catch (Exception e) {
            log.error("avatar cascade failed — path={}", path, e);
        }
    }
}

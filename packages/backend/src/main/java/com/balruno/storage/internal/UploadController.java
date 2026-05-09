// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.security.Principals;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/**
 * Upload routes. Validation + storage + quota live in
 * {@link UploadService}; this class is a thin route + DTO surface.
 *
 * Naming convention:
 *   - avatars/{userId}/{hash}.{ext}      — user-scoped
 *   - attachments/{projectId}/{hash}.{ext} — project-scoped
 *
 * Both paths are content-addressed by SHA-256 prefix so the same
 * file dedupes to the same URL and the immutable Cache-Control on
 * the /media/* serving side stays accurate.
 */
@RestController
@Tag(name = "Upload")
@SecurityRequirement(name = "bearerAuth")
class UploadController {

    private final UploadService uploads;

    UploadController(UploadService uploads) {
        this.uploads = uploads;
    }

    @PostMapping(path = "/uploads/avatar", version = "1", consumes = "multipart/form-data")
    UploadResult uploadAvatar(@AuthenticationPrincipal Jwt jwt,
                              @RequestParam("file") MultipartFile file) throws IOException {
        var userId = Principals.userId(jwt);
        return new UploadResult(uploads.uploadAvatar(userId, file));
    }

    @PostMapping(path = "/uploads/attachment", version = "1", consumes = "multipart/form-data")
    UploadResult uploadAttachment(@AuthenticationPrincipal Jwt jwt,
                                  @RequestParam("projectId") UUID projectId,
                                  @RequestParam(value = "refKind", required = false) String refKind,
                                  @RequestParam(value = "refId", required = false) UUID refId,
                                  @RequestParam("file") MultipartFile file) throws IOException {
        var callerId = Principals.userId(jwt);
        return new UploadResult(uploads.uploadAttachment(callerId, projectId, refKind, refId, file));
    }

    /** Public response — the URL the client stores on user.avatarUrl, doc body, etc. */
    public record UploadResult(String url) {}
}

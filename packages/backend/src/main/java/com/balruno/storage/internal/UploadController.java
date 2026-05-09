// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.StorageService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Authenticated multipart upload surface. Each endpoint owns its
 * path namespace inside the storage backend so unrelated objects
 * can't collide and so future cache rules can target a sub-tree.
 *
 * Naming convention (Phase B): {@code avatars/{userId}/{hash}.{ext}}
 *   - userId scopes ownership and bounds enumeration cost.
 *   - hash is the SHA-256 prefix of the bytes — same image dedupes
 *     to the same path, enabling immutable Cache-Control.
 *   - ext is canonicalised from the mime type (no upload-supplied
 *     name leaks into the URL).
 *
 * Validation:
 *   - 2 MB hard cap (avatar use case; ServletContext also enforces
 *     spring.servlet.multipart.max-file-size so the cap fires before
 *     the bytes hit memory).
 *   - Content-type allowlist: png / jpeg / webp / gif. SVG excluded
 *     — XSS surface from inline scripts.
 */
@RestController
@Tag(name = "Upload")
@SecurityRequirement(name = "bearerAuth")
class UploadController {

    private static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;
    private static final Map<String, String> AVATAR_EXT_BY_MIME = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "image/webp", "webp",
            "image/gif", "gif"
    );
    private static final Set<String> ALLOWED_AVATAR_MIMES = AVATAR_EXT_BY_MIME.keySet();

    private final StorageService storage;

    UploadController(StorageService storage) {
        this.storage = storage;
    }

    @PostMapping(path = "/api/v1/uploads/avatar", consumes = "multipart/form-data")
    UploadResult uploadAvatar(@AuthenticationPrincipal Jwt jwt,
                              @RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "avatar may not exceed 2 MB");
        }
        var contentType = normaliseContentType(file.getContentType());
        if (!ALLOWED_AVATAR_MIMES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "avatar must be png / jpeg / webp / gif");
        }
        var bytes = file.getBytes();
        var hash = sha256Hex(bytes).substring(0, 32);
        var ext = AVATAR_EXT_BY_MIME.get(contentType);
        var userId = UUID.fromString(jwt.getSubject());
        var path = "avatars/%s/%s.%s".formatted(userId, hash, ext);
        storage.store(path, bytes, contentType);
        return new UploadResult("/media/" + path);
    }

    private static String normaliseContentType(String raw) {
        if (raw == null) return "";
        // Browsers occasionally append parameters like "; charset=...".
        // Strip them so the allowlist check stays simple.
        var idx = raw.indexOf(';');
        return (idx >= 0 ? raw.substring(0, idx) : raw).trim().toLowerCase();
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            var md = MessageDigest.getInstance("SHA-256");
            var digest = md.digest(bytes);
            var sb = new StringBuilder(digest.length * 2);
            for (var b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** Public response — the URL is what the client stores in users.avatar_url etc. */
    public record UploadResult(String url) {}
}

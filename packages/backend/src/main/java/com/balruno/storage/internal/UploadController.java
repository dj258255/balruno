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
import java.util.Arrays;
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

    @PostMapping(path = "/uploads/avatar", version = "1", consumes = "multipart/form-data")
    UploadResult uploadAvatar(@AuthenticationPrincipal Jwt jwt,
                              @RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "avatar may not exceed 2 MB");
        }
        var declaredType = normaliseContentType(file.getContentType());
        if (!ALLOWED_AVATAR_MIMES.contains(declaredType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "avatar must be png / jpeg / webp / gif");
        }
        var bytes = file.getBytes();
        // Defence-in-depth: the Content-Type header is client-supplied and
        // can lie. Sniff the magic bytes to detect rename attacks (e.g.
        // .html bytes uploaded as image/png) before we ever store the
        // blob. A mismatch returns 415 with the SNIFFED type so the
        // client error surface stays uniform with the allowlist case.
        var sniffedType = sniffImageType(bytes);
        if (sniffedType == null || !sniffedType.equals(declaredType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "avatar bytes do not match the declared image type");
        }
        var hash = sha256Hex(bytes).substring(0, 32);
        var ext = AVATAR_EXT_BY_MIME.get(sniffedType);
        var userId = UUID.fromString(jwt.getSubject());
        var path = "avatars/%s/%s.%s".formatted(userId, hash, ext);
        // Always store with the SNIFFED type so the served Content-Type
        // can never reflect a hostile client's lie.
        storage.store(path, bytes, sniffedType);
        return new UploadResult("/media/" + path);
    }

    /**
     * Magic-byte sniffer for the four image types we accept. Returns
     * {@code null} for anything else; callers map that to 415.
     *
     *   PNG    89 50 4E 47 0D 0A 1A 0A
     *   JPEG   FF D8 FF
     *   WebP   "RIFF" .... "WEBP"          (12-byte container header)
     *   GIF    "GIF87a" or "GIF89a"
     */
    static String sniffImageType(byte[] bytes) {
        if (bytes == null) return null;
        if (bytes.length >= 8 && Arrays.equals(
                Arrays.copyOfRange(bytes, 0, 8),
                new byte[] { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) {
            return "image/png";
        }
        if (bytes.length >= 3
                && bytes[0] == (byte) 0xFF
                && bytes[1] == (byte) 0xD8
                && bytes[2] == (byte) 0xFF) {
            return "image/jpeg";
        }
        if (bytes.length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return "image/webp";
        }
        if (bytes.length >= 6
                && bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F'
                && bytes[3] == '8'
                && (bytes[4] == '7' || bytes[4] == '9')
                && bytes[5] == 'a') {
            return "image/gif";
        }
        return null;
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

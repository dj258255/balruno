// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.project.ProjectService;
import com.balruno.storage.StorageService;
import com.balruno.storage.WorkspaceStorageService;
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
    private static final long MAX_ATTACHMENT_BYTES = 50L * 1024 * 1024;
    private static final Map<String, String> AVATAR_EXT_BY_MIME = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "image/webp", "webp",
            "image/gif", "gif"
    );
    private static final Set<String> ALLOWED_AVATAR_MIMES = AVATAR_EXT_BY_MIME.keySet();

    /**
     * Attachment allowlist — image set + a small office / archive set.
     * SVG still excluded (XSS surface). Office formats (docx/xlsx/pptx)
     * share the ZIP container so the magic-byte sniff returns the same
     * "application/zip" signature; the declared content-type narrows it.
     */
    private static final Map<String, String> ATTACHMENT_EXT_BY_MIME = Map.ofEntries(
            Map.entry("image/png", "png"),
            Map.entry("image/jpeg", "jpg"),
            Map.entry("image/webp", "webp"),
            Map.entry("image/gif", "gif"),
            Map.entry("application/pdf", "pdf"),
            Map.entry("application/zip", "zip"),
            Map.entry("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            Map.entry("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
            Map.entry("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"),
            Map.entry("text/csv", "csv"),
            Map.entry("text/plain", "txt")
    );
    private static final Set<String> ALLOWED_ATTACHMENT_MIMES = ATTACHMENT_EXT_BY_MIME.keySet();

    private final StorageService storage;
    private final WorkspaceStorageService workspaceStorage;
    private final ProjectService projects;

    UploadController(StorageService storage,
                     WorkspaceStorageService workspaceStorage,
                     ProjectService projects) {
        this.storage = storage;
        this.workspaceStorage = workspaceStorage;
        this.projects = projects;
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
     * Project-scoped general attachment upload (Phase D).
     *
     * Path: {@code attachments/{projectId}/{sha256-prefix}.{ext}} —
     * project scoping bounds enumeration cost and matches how doc /
     * sheet content references will reach the file. The sha256 prefix
     * dedupes identical content, enabling the same immutable
     * Cache-Control as avatars.
     *
     * Quota: WorkspaceStorageService.incrementOrThrow runs against
     * the project's owning workspace. The pre-mutation check inside
     * incrementOrThrow holds a row lock on workspace_storage so two
     * concurrent uploads can't collectively breach the cap.
     */
    @PostMapping(path = "/uploads/attachment", version = "1", consumes = "multipart/form-data")
    UploadResult uploadAttachment(@AuthenticationPrincipal Jwt jwt,
                                  @RequestParam("projectId") UUID projectId,
                                  @RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required");
        }
        if (file.getSize() > MAX_ATTACHMENT_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "attachment may not exceed 50 MB");
        }
        var declaredType = normaliseContentType(file.getContentType());
        if (!ALLOWED_ATTACHMENT_MIMES.contains(declaredType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "attachment mime not in allowlist");
        }

        // Auth + workspace lookup — non-members of the project throw
        // ProjectException(PROJECT_NOT_FOUND) inside findById.
        var callerId = UUID.fromString(jwt.getSubject());
        var project = projects.findById(projectId, callerId);

        var bytes = file.getBytes();
        var sniffedType = sniffAttachmentType(bytes, declaredType);
        if (sniffedType == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "attachment bytes do not match a recognised signature");
        }
        // For the Office / ZIP family the magic-byte sniff returns
        // "application/zip" but the declared type may be the more
        // specific docx/xlsx/pptx; trust the declaration once the
        // container shape is verified.
        var storedType = isZipFamily(declaredType) && "application/zip".equals(sniffedType)
                ? declaredType
                : sniffedType;
        if (!storedType.equals(declaredType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "attachment bytes do not match the declared mime");
        }

        // Reserve quota first — throws QuotaException (mapped to 429
        // by ApiExceptionHandler) when the workspace is at the cap.
        // Doing this BEFORE storage.store keeps no orphan if quota
        // refuses; doing it after would mean a successful R2 write
        // followed by an unwind path.
        workspaceStorage.incrementOrThrow(project.workspaceId(), file.getSize());

        var hash = sha256Hex(bytes).substring(0, 32);
        var ext = ATTACHMENT_EXT_BY_MIME.get(storedType);
        var path = "attachments/%s/%s.%s".formatted(projectId, hash, ext);
        storage.store(path, bytes, storedType);
        return new UploadResult("/media/" + path);
    }

    private static boolean isZipFamily(String mime) {
        return mime != null && (mime.startsWith("application/vnd.openxmlformats-")
                || "application/zip".equals(mime));
    }

    /**
     * Attachment magic-byte sniffer — image signatures from the avatar
     * sniffer plus PDF / ZIP / plain text. The result is the broad
     * type ("application/zip" for any docx/xlsx/pptx); the caller
     * cross-checks against the declared type.
     *
     *   PDF    "%PDF-"
     *   ZIP    PK\x03\x04 or PK\x05\x06 (empty) or PK\x07\x08 (spanned)
     *   CSV    no signature — defer to declared type for the same shape
     *   TXT    no signature — defer to declared type for the same shape
     */
    static String sniffAttachmentType(byte[] bytes, String declaredType) {
        var imageType = sniffImageType(bytes);
        if (imageType != null) return imageType;
        if (bytes != null && bytes.length >= 4
                && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F') {
            return "application/pdf";
        }
        if (bytes != null && bytes.length >= 4
                && bytes[0] == 'P' && bytes[1] == 'K'
                && (bytes[2] == 0x03 || bytes[2] == 0x05 || bytes[2] == 0x07)
                && (bytes[3] == 0x04 || bytes[3] == 0x06 || bytes[3] == 0x08)) {
            return "application/zip";
        }
        // text/csv and text/plain don't have signatures; trust the
        // declared type AFTER the size + allowlist checks have
        // already gated the upload.
        if ("text/csv".equals(declaredType) || "text/plain".equals(declaredType)) {
            return declaredType;
        }
        return null;
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

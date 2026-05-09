// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.project.ProjectService;
import com.balruno.storage.AttachmentReferenceService;
import com.balruno.storage.StorageService;
import com.balruno.storage.WorkspaceStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Validation + storage + quota for the upload endpoints. Pulled out
 * of {@link UploadController} so the controller stays a thin route
 * + DTO layer; this service owns the actual byte handling.
 *
 * Each upload type (avatar / attachment) lives behind its own method
 * because the constraints differ — avatar is user-scoped and 2MB,
 * attachment is project-scoped and 50MB. They share helpers
 * (sniff, hash, normalise) for consistency.
 */
@Service
class UploadService {

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
    private final AttachmentReferenceService attachmentRefs;

    UploadService(StorageService storage,
                  WorkspaceStorageService workspaceStorage,
                  ProjectService projects,
                  AttachmentReferenceService attachmentRefs) {
        this.storage = storage;
        this.workspaceStorage = workspaceStorage;
        this.projects = projects;
        this.attachmentRefs = attachmentRefs;
    }

    /**
     * Avatar pipeline: 2MB cap, image-only, user-scoped path. The
     * sniffed type must equal the declared type (no zip-family
     * narrowing here — avatars don't accept office formats).
     */
    String uploadAvatar(UUID userId, MultipartFile file) throws IOException {
        var bytes = readAndCap(file, MAX_AVATAR_BYTES, "avatar may not exceed 2 MB");
        var declared = normaliseContentType(file.getContentType());
        requireMime(declared, ALLOWED_AVATAR_MIMES, "avatar must be png / jpeg / webp / gif");
        var sniffed = MimeSniffer.sniffImage(bytes);
        if (sniffed == null || !sniffed.equals(declared)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "avatar bytes do not match the declared image type");
        }
        var ext = AVATAR_EXT_BY_MIME.get(sniffed);
        var path = "avatars/%s/%s.%s".formatted(userId, hashPrefix(bytes), ext);
        storage.store(path, bytes, sniffed);
        return "/media/" + path;
    }

    /**
     * Attachment pipeline: 50MB cap, broader allowlist, project-
     * scoped path. The Office / ZIP family is reconciled so the
     * stored mime is the declared (specific) one even when the
     * sniff returns generic application/zip.
     *
     * refKind / refId is optional — when provided the upload is
     * recorded against that content (comment / doc / cell). The
     * orphan-cleanup hooks key on this. Without a ref the upload
     * still succeeds but only the project-cascade catches the
     * eventual cleanup.
     */
    String uploadAttachment(UUID callerId,
                            UUID projectId,
                            String refKind,
                            UUID refId,
                            MultipartFile file) throws IOException {
        var bytes = readAndCap(file, MAX_ATTACHMENT_BYTES, "attachment may not exceed 50 MB");
        var declared = normaliseContentType(file.getContentType());
        requireMime(declared, ALLOWED_ATTACHMENT_MIMES, "attachment mime not in allowlist");

        // Project membership check — non-members get 404 here.
        var project = projects.findById(projectId, callerId);

        var sniffed = MimeSniffer.detect(bytes, declared);
        if (sniffed == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "attachment bytes do not match a recognised signature");
        }
        var stored = isZipFamily(declared) && "application/zip".equals(sniffed)
                ? declared
                : sniffed;
        if (!stored.equals(declared)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "attachment bytes do not match the declared mime");
        }

        // Reserve quota BEFORE storage.store so a refused upload
        // never produces an orphan blob in R2.
        workspaceStorage.incrementOrThrow(project.workspaceId(), file.getSize());

        var ext = ATTACHMENT_EXT_BY_MIME.get(stored);
        var path = "attachments/%s/%s.%s".formatted(projectId, hashPrefix(bytes), ext);
        storage.store(path, bytes, stored);

        // Record the reference so the orphan-cleanup hooks can find
        // and free this blob when the source content is removed.
        // Unrecognised refKind values are ignored (silent fallback)
        // so the upload still succeeds and project-cascade catches it.
        var parsedKind = parseRefKind(refKind);
        if (parsedKind != null && refId != null) {
            attachmentRefs.register(project.workspaceId(), path, parsedKind, refId, file.getSize());
        }
        return "/media/" + path;
    }

    private static AttachmentReferenceService.RefKind parseRefKind(String raw) {
        if (raw == null) return null;
        try {
            return AttachmentReferenceService.RefKind.valueOf(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // ── shared helpers ────────────────────────────────────────────────

    private static byte[] readAndCap(MultipartFile file, long cap, String oversizeMessage) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required");
        }
        if (file.getSize() > cap) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, oversizeMessage);
        }
        return file.getBytes();
    }

    private static void requireMime(String declared, Set<String> allowed, String message) {
        if (!allowed.contains(declared)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, message);
        }
    }

    private static String normaliseContentType(String raw) {
        if (raw == null) return "";
        // Browsers occasionally append parameters like "; charset=...".
        // Strip them so the allowlist check stays simple.
        var idx = raw.indexOf(';');
        return (idx >= 0 ? raw.substring(0, idx) : raw).trim().toLowerCase();
    }

    private static boolean isZipFamily(String mime) {
        return mime != null && (mime.startsWith("application/vnd.openxmlformats-")
                || "application/zip".equals(mime));
    }

    /**
     * SHA-256 hex prefix used as the content-addressed filename.
     * 32 hex chars = 128 bits — collision probability is negligible
     * for the avatar / attachment scale we're operating at.
     */
    private static String hashPrefix(byte[] bytes) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            var sb = new StringBuilder(64);
            for (var b : digest) sb.append(String.format("%02x", b));
            return sb.substring(0, 32);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

/**
 * Object-storage abstraction used by the upload + /media surfaces.
 * Two adapters live behind it:
 *
 *  - {@code R2StorageAdapter} — Cloudflare R2 via the S3 API. Used by
 *    the Balruno SaaS deployment. Configured by the
 *    {@code BALRUNO_R2_*} env vars in production; opt-in via
 *    {@code BALRUNO_STORAGE=r2}.
 *
 *  - {@code LocalFsStorageAdapter} — files on disk under
 *    {@code BALRUNO_DATA_DIR}. Default for self-hosters so they don't
 *    need an S3-compatible bucket on day one (Baserow pattern).
 *
 * Paths are application-defined (e.g. {@code avatars/{userId}/{hash}.png}).
 * The service treats them as opaque keys + intentionally does not
 * track them in Postgres — content-addressed paths are immutable, so
 * the URL itself is the authoritative reference.
 */
public interface StorageService {

    /**
     * Persist a blob at {@code path}. Re-uploads of the same content
     * (same hash → same path) are allowed but the adapter must
     * tolerate the overwrite as a no-op.
     */
    void store(String path, byte[] bytes, String contentType) throws IOException;

    /**
     * Read a previously stored object. Empty optional when the object
     * does not exist; raises {@link IOException} only on transport
     * failures (network, permission). The caller decides whether
     * empty maps to 404 or some richer fallback.
     */
    Optional<StoredObject> read(String path) throws IOException;

    /**
     * Best-effort delete — orphan-cleanup callers (avatar replace,
     * future attachment delete) use this. Missing objects are NOT
     * an error; transport failures (network / permission) raise
     * IOException. Implementations should not delete sidecar files
     * for missing primary blobs (that's a one-shot housekeeping
     * concern, not an idempotent delete invariant).
     */
    void delete(String path) throws IOException;

    /**
     * Cascade delete every blob under {@code prefix}. Returns the
     * total bytes removed so callers can decrement workspace storage
     * counters atomically. Used by project / workspace soft-delete
     * cascades and the GDPR account-delete path.
     *
     * Empty prefix is rejected to prevent accidental whole-bucket
     * wipe; callers always pass scoped prefixes like
     * {@code attachments/{projectId}/}.
     */
    long deleteByPrefix(String prefix) throws IOException;

    /** Returned by {@link #read} — bytes + content-type for HTTP response. */
    record StoredObject(InputStream content, String contentType, long contentLength) {}
}

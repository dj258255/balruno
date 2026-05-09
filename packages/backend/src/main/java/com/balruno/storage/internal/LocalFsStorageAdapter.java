// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Optional;

/**
 * {@link StorageService} backed by the local filesystem. Default for
 * self-hosters — no S3-compatible bucket required on day one
 * (Baserow pattern). Activated when {@code balruno.storage.backend}
 * is unset, {@code local}, or anything other than {@code r2}.
 *
 * Path traversal is rejected at the controller layer by hash-based
 * key construction. This adapter additionally normalises any
 * {@code ..} segment as a defence-in-depth measure.
 */
@Component
@ConditionalOnProperty(prefix = "balruno.storage", name = "backend", havingValue = "local", matchIfMissing = true)
class LocalFsStorageAdapter implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalFsStorageAdapter.class);

    private final Path root;

    LocalFsStorageAdapter(StorageProperties props) {
        this.root = Path.of(props.localDir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
            log.info("local storage root = {}", root);
        } catch (IOException e) {
            throw new IllegalStateException("cannot create storage root: " + root, e);
        }
    }

    @Override
    public void store(String path, byte[] bytes, String contentType) throws IOException {
        var target = resolveSafe(path);
        Files.createDirectories(target.getParent());
        Files.write(target, bytes,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING,
                StandardOpenOption.WRITE);
        // Content-type sidecar — local FS has no metadata layer, so we
        // keep the MIME next to the blob in {path}.ct. Reads consult
        // the sidecar; absence falls back to application/octet-stream.
        Files.writeString(target.resolveSibling(target.getFileName() + ".ct"),
                contentType == null ? "application/octet-stream" : contentType);
    }

    @Override
    public Optional<StoredObject> read(String path) throws IOException {
        var target = resolveSafe(path);
        if (!Files.exists(target)) return Optional.empty();
        var contentType = readSidecar(target);
        var size = Files.size(target);
        return Optional.of(new StoredObject(
                Files.newInputStream(target, StandardOpenOption.READ),
                contentType,
                size));
    }

    private Path resolveSafe(String key) {
        var resolved = root.resolve(key).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("path escapes storage root: " + key);
        }
        return resolved;
    }

    private static String readSidecar(Path blob) {
        var sidecar = blob.resolveSibling(blob.getFileName() + ".ct");
        try {
            return Files.readString(sidecar);
        } catch (IOException e) {
            return "application/octet-stream";
        }
    }
}

/** Marker so {@link StorageProperties} is registered without scanning. */
@Configuration
@org.springframework.boot.context.properties.EnableConfigurationProperties(StorageProperties.class)
class StoragePropertiesConfig {}

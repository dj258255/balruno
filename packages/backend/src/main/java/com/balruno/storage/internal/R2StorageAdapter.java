// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.util.Optional;

/**
 * {@link StorageService} backed by Cloudflare R2 via the S3 API.
 * Active when {@code BALRUNO_STORAGE=r2} (or
 * {@code balruno.storage.backend=r2}). Endpoint + bucket + creds
 * come from {@link StorageProperties}.
 *
 * R2 quirks:
 *  - Region is always {@code auto} regardless of jurisdiction; the
 *    SDK rejects {@code null} so we set {@link Region#US_EAST_1}
 *    as the canonical "no-region" stand-in (matches R2 docs).
 *  - Path-style addressing isn't required for R2 + custom domain,
 *    but it works on the cloudflarestorage.com endpoint without DNS
 *    setup so we leave it on.
 */
@Component
@ConditionalOnProperty(prefix = "balruno.storage", name = "backend", havingValue = "r2")
class R2StorageAdapter implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(R2StorageAdapter.class);

    private final S3Client s3;
    private final String bucket;

    R2StorageAdapter(StorageProperties props) {
        var r2 = props.r2();
        if (r2 == null
                || isBlank(r2.endpoint())
                || isBlank(r2.bucket())
                || isBlank(r2.accessKey())
                || isBlank(r2.secretKey())) {
            throw new IllegalStateException(
                    "balruno.storage.backend=r2 but BALRUNO_R2_* env vars are not set");
        }
        this.bucket = r2.bucket();
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create(r2.endpoint()))
                .region(Region.US_EAST_1) // R2 ignores region but SDK requires one
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(r2.accessKey(), r2.secretKey())))
                .forcePathStyle(true)
                .build();
        log.info("R2 storage configured (bucket={}, endpoint={})", bucket, r2.endpoint());
    }

    @Override
    public void store(String path, byte[] bytes, String contentType) throws IOException {
        try {
            var req = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(path)
                    .contentType(contentType == null ? "application/octet-stream" : contentType)
                    .cacheControl("public, max-age=31536000, immutable")
                    .build();
            s3.putObject(req, RequestBody.fromBytes(bytes));
        } catch (Exception e) {
            throw new IOException("R2 putObject failed: " + path, e);
        }
    }

    @Override
    public long deleteByPrefix(String prefix) throws IOException {
        if (prefix == null || prefix.isBlank()) {
            throw new IllegalArgumentException("prefix must be non-empty (whole-bucket wipe blocked)");
        }
        long totalBytes = 0L;
        String continuation = null;
        try {
            // Page through the listing — R2 / S3 list API caps at
            // 1000 keys per response. Continuation token drives the
            // next page. Each page's keys are batch-deleted (S3
            // DeleteObjects supports up to 1000 per call).
            do {
                var listReq = ListObjectsV2Request.builder()
                        .bucket(bucket)
                        .prefix(prefix)
                        .continuationToken(continuation)
                        .build();
                var listResp = s3.listObjectsV2(listReq);
                var items = listResp.contents();
                if (items.isEmpty()) break;

                var keys = new java.util.ArrayList<ObjectIdentifier>();
                for (var item : items) {
                    keys.add(ObjectIdentifier.builder().key(item.key()).build());
                    if (item.size() != null) totalBytes += item.size();
                }

                s3.deleteObjects(DeleteObjectsRequest.builder()
                        .bucket(bucket)
                        .delete(Delete.builder().objects(keys).quiet(true).build())
                        .build());

                continuation = Boolean.TRUE.equals(listResp.isTruncated())
                        ? listResp.nextContinuationToken()
                        : null;
            } while (continuation != null);
        } catch (Exception e) {
            throw new IOException("R2 deleteByPrefix failed: " + prefix, e);
        }
        return totalBytes;
    }

    @Override
    public void delete(String path) throws IOException {
        try {
            s3.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(path)
                    .build());
        } catch (NoSuchKeyException missing) {
            // R2 / S3 deleteObject is idempotent and never throws on
            // missing keys; this catch is a defensive no-op for SDK
            // implementations that disagree.
        } catch (Exception e) {
            throw new IOException("R2 deleteObject failed: " + path, e);
        }
    }

    @Override
    public Optional<StoredObject> read(String path) throws IOException {
        ResponseInputStream<GetObjectResponse> response;
        try {
            response = s3.getObject(GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(path)
                    .build());
        } catch (NoSuchKeyException missing) {
            return Optional.empty();
        } catch (Exception e) {
            throw new IOException("R2 getObject failed: " + path, e);
        }
        var meta = response.response();
        return Optional.of(new StoredObject(
                response,
                meta.contentType() == null ? "application/octet-stream" : meta.contentType(),
                meta.contentLength() == null ? -1L : meta.contentLength()));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}

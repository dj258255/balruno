// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

/**
 * {@code balruno.storage.*} configuration tree. Bound from
 * application.yml + env-var overrides at boot. Values land in the
 * matching {@link R2StorageAdapter} / {@link LocalFsStorageAdapter}
 * via constructor injection; {@code @ConditionalOnProperty} on
 * {@code balruno.storage.backend} picks one bean.
 */
@ConfigurationProperties(prefix = "balruno.storage")
public record StorageProperties(
        /** {@code r2} or {@code local}. Default: {@code local} (self-host friendly). */
        String backend,
        /** Directory for {@link LocalFsStorageAdapter}. Created if missing. */
        String localDir,
        R2 r2
) {
    @ConstructorBinding
    public StorageProperties {
        if (backend == null || backend.isBlank()) backend = "local";
        if (localDir == null || localDir.isBlank()) localDir = "/var/lib/balruno/media";
        if (r2 == null) r2 = new R2(null, null, null, null);
    }

    public record R2(
            /** R2 S3 endpoint, e.g. {@code https://<acct>.r2.cloudflarestorage.com}. */
            String endpoint,
            String bucket,
            String accessKey,
            String secretKey
    ) {}
}

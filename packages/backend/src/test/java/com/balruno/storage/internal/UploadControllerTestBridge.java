// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

/**
 * Same-package bridge that re-exports {@link UploadController#sniffImageType}
 * to the public test in {@code com.balruno.storage}. UploadController is
 * package-private (Spring Modulith arch test rejects exposing internal/
 * classes outside the module); this helper sits inside the module so the
 * test can stay outside.
 */
public final class UploadControllerTestBridge {
    private UploadControllerTestBridge() {}

    public static String sniff(byte[] bytes) {
        return UploadController.sniffImageType(bytes);
    }
}

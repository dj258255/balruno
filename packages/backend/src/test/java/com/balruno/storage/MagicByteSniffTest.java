// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage;

import com.balruno.storage.internal.UploadControllerTestBridge;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Locks the magic-byte sniff behaviour in UploadController.sniffImageType
 * so a future refactor (e.g. swapping to a library) doesn't loosen the
 * accepted set or accidentally permit content-type mismatches.
 */
class MagicByteSniffTest {

    @Test
    void sniffsPng() {
        var png = new byte[]{ (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00 };
        assertEquals("image/png", UploadControllerTestBridge.sniff(png));
    }

    @Test
    void sniffsJpeg() {
        var jpeg = new byte[]{ (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0 };
        assertEquals("image/jpeg", UploadControllerTestBridge.sniff(jpeg));
    }

    @Test
    void sniffsWebp() {
        var webp = new byte[]{ 'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P' };
        assertEquals("image/webp", UploadControllerTestBridge.sniff(webp));
    }

    @Test
    void sniffsGif87a() {
        var gif = new byte[]{ 'G', 'I', 'F', '8', '7', 'a', 0 };
        assertEquals("image/gif", UploadControllerTestBridge.sniff(gif));
    }

    @Test
    void sniffsGif89a() {
        var gif = new byte[]{ 'G', 'I', 'F', '8', '9', 'a', 0 };
        assertEquals("image/gif", UploadControllerTestBridge.sniff(gif));
    }

    @Test
    void rejectsHtmlMasqueradingAsImage() {
        var html = "<html><script>alert(1)</script></html>".getBytes();
        assertNull(UploadControllerTestBridge.sniff(html));
    }

    @Test
    void rejectsTooShort() {
        assertNull(UploadControllerTestBridge.sniff(new byte[]{ 0x00, 0x01 }));
    }

    @Test
    void rejectsNull() {
        assertNull(UploadControllerTestBridge.sniff(null));
    }

    @Test
    void rejectsSvg() {
        // SVG is intentionally excluded — inline scripts are an XSS surface.
        var svg = "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\">".getBytes();
        assertNull(UploadControllerTestBridge.sniff(svg));
    }
}

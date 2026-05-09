// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import java.util.Arrays;

/**
 * Single-source magic-byte sniffer for the upload pipeline. Extracted
 * from UploadController so the validators in {@link UploadService}
 * stay slim and the signatures live in one auditable file.
 *
 * Why hand-rolled instead of Apache Tika: Tika carries a 50MB JAR +
 * pulls a parser stack we don't otherwise need. We accept exactly
 * 11 mime types — image/{png,jpeg,webp,gif} + pdf + zip family +
 * text/csv + text/plain — and the magic bytes for those fit in
 * &lt;100 LOC of branchless byte comparisons.
 *
 * Office formats (docx / xlsx / pptx) all share the ZIP container
 * signature {@code PK\x03\x04}; the sniff returns the broad
 * {@code application/zip} and the caller cross-checks against the
 * declared mime to narrow it. text/csv and text/plain have no
 * signature — for those we trust the declared type AFTER the
 * size + allowlist gates have already fired.
 */
final class MimeSniffer {

    private MimeSniffer() {}

    /**
     * Detect the mime type of the bytes. {@code declared} lets the
     * sniffer fall back for signature-less types (text/csv,
     * text/plain). Returns {@code null} when no signature matches
     * and the declared type isn't on the trust-by-declaration list.
     */
    static String detect(byte[] bytes, String declared) {
        var image = sniffImage(bytes);
        if (image != null) return image;
        if (matches(bytes, PDF_SIG)) return "application/pdf";
        if (isZipHeader(bytes)) return "application/zip";
        // Signature-less plain text formats trust the declared type.
        // Allowlist checks elsewhere ensure we never reach this with
        // hostile mime values.
        if ("text/csv".equals(declared) || "text/plain".equals(declared)) {
            return declared;
        }
        return null;
    }

    /**
     * Image-only variant used by the avatar path. Same matchers as
     * {@link #detect} for image types — kept separate so the avatar
     * pipeline can reject everything non-image with a single call.
     */
    static String sniffImage(byte[] bytes) {
        if (bytes == null) return null;
        if (matches(bytes, PNG_SIG)) return "image/png";
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

    private static boolean matches(byte[] bytes, byte[] sig) {
        return bytes != null
                && bytes.length >= sig.length
                && Arrays.equals(Arrays.copyOfRange(bytes, 0, sig.length), sig);
    }

    /**
     * ZIP local file header is {@code PK\x03\x04}. End-of-archive
     * ({@code PK\x05\x06}) and spanned-archive ({@code PK\x07\x08})
     * also start with {@code PK} — accepted defensively so a tool
     * that begins its archive with the central directory still
     * passes. All three start with {@code PK} byte 1.
     */
    private static boolean isZipHeader(byte[] bytes) {
        if (bytes == null || bytes.length < 4) return false;
        if (bytes[0] != 'P' || bytes[1] != 'K') return false;
        return (bytes[2] == 0x03 || bytes[2] == 0x05 || bytes[2] == 0x07)
                && (bytes[3] == 0x04 || bytes[3] == 0x06 || bytes[3] == 0x08);
    }

    private static final byte[] PNG_SIG = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };
    private static final byte[] PDF_SIG = { '%', 'P', 'D', 'F', '-' };
}

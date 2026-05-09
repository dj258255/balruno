// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import com.balruno.storage.AttachmentReferenceService;
import com.balruno.storage.StorageService;
import com.balruno.storage.WorkspaceStorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * UploadService unit tests organised by scenario. Negative paths
 * (rejected mime, magic-byte mismatch, oversize, non-member project)
 * outnumber positive paths because the service is the security
 * boundary between MultipartFile bytes and storage / quota state —
 * "wrong" must fail loudly before "right" can succeed.
 *
 * MimeSniffer is package-private and pure — exercised through the
 * service rather than mocked, so the suite verifies the
 * declared/sniffed contract end-to-end with only StorageService /
 * WorkspaceStorageService / ProjectService / AttachmentReferenceService
 * stubbed by Mockito.
 */
@ExtendWith(MockitoExtension.class)
class UploadServiceTest {

    @Mock StorageService storage;
    @Mock WorkspaceStorageService workspaceStorage;
    @Mock ProjectService projects;
    @Mock AttachmentReferenceService attachmentRefs;
    @InjectMocks UploadService service;

    // ── PNG/JPEG/WebP/GIF/PDF/ZIP magic bytes ─────────────────────────

    private static final byte[] PNG_MAGIC = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            // pad with zeros so SHA-256 hashes deterministically
            0x00, 0x00, 0x00
    };
    private static final byte[] JPEG_MAGIC = {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00, 0x00
    };
    private static final byte[] WEBP_MAGIC = {
            'R', 'I', 'F', 'F', 0x00, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P', 0x00
    };
    private static final byte[] GIF_MAGIC = {
            'G', 'I', 'F', '8', '9', 'a', 0x00
    };
    private static final byte[] PDF_MAGIC = {
            '%', 'P', 'D', 'F', '-', '1', '.', '4', 0x00
    };
    private static final byte[] ZIP_MAGIC = {
            'P', 'K', 0x03, 0x04, 0x00, 0x00, 0x00, 0x00
    };

    // ── uploadAvatar ──────────────────────────────────────────────────

    @Nested
    @DisplayName("uploadAvatar — Happy")
    class AvatarHappy {

        @Test
        void png_upload_returns_user_scoped_media_path_and_stores_bytes() throws Exception {
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("file", "avatar.png", "image/png", PNG_MAGIC);

            var url = service.uploadAvatar(userId, file);

            assertThat(url).startsWith("/media/avatars/" + userId + "/").endsWith(".png");
            verify(storage).store(anyString(), eq(PNG_MAGIC), eq("image/png"));
        }

        @Test
        void jpeg_upload_uses_jpg_extension_in_path() throws Exception {
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.jpg", "image/jpeg", JPEG_MAGIC);
            assertThat(service.uploadAvatar(userId, file)).endsWith(".jpg");
        }

        @Test
        void webp_upload_uses_webp_extension() throws Exception {
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.webp", "image/webp", WEBP_MAGIC);
            assertThat(service.uploadAvatar(userId, file)).endsWith(".webp");
        }

        @Test
        void gif_upload_uses_gif_extension() throws Exception {
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.gif", "image/gif", GIF_MAGIC);
            assertThat(service.uploadAvatar(userId, file)).endsWith(".gif");
        }

        @Test
        void content_type_with_charset_parameter_is_normalised() throws Exception {
            // Browsers occasionally send "image/png; charset=binary" — the
            // service strips the parameter before allowlist comparison.
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.png",
                    "image/png; charset=binary", PNG_MAGIC);
            assertThat(service.uploadAvatar(userId, file)).endsWith(".png");
        }

        @Test
        void same_bytes_twice_produce_identical_path_idempotent_dedup() throws Exception {
            // Content-addressed: SHA-256 prefix means the same bytes
            // dedupe to the same /media/* URL across re-uploads.
            var userId = UUID.randomUUID();
            var file1 = new MockMultipartFile("f", "a.png", "image/png", PNG_MAGIC);
            var file2 = new MockMultipartFile("f", "b.png", "image/png", PNG_MAGIC);

            assertThat(service.uploadAvatar(userId, file1))
                    .isEqualTo(service.uploadAvatar(userId, file2));
        }
    }

    @Nested
    @DisplayName("uploadAvatar — Error")
    class AvatarError {

        @Test
        void empty_file_throws_400() {
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.png", "image/png", new byte[0]);
            assertThatThrownBy(() -> service.uploadAvatar(userId, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        void over_2mb_throws_413() {
            var userId = UUID.randomUUID();
            var huge = new byte[2 * 1024 * 1024 + 1];
            // Fill with PNG header so the size gate fires before the mime gate.
            System.arraycopy(PNG_MAGIC, 0, huge, 0, PNG_MAGIC.length);
            var file = new MockMultipartFile("f", "x.png", "image/png", huge);
            assertThatThrownBy(() -> service.uploadAvatar(userId, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
        }

        @Test
        void exactly_at_cap_passes() throws Exception {
            // 2MB exactly. Boundary: PAYLOAD_TOO_LARGE only at >2MB.
            var userId = UUID.randomUUID();
            var atCap = new byte[2 * 1024 * 1024];
            System.arraycopy(PNG_MAGIC, 0, atCap, 0, PNG_MAGIC.length);
            var file = new MockMultipartFile("f", "x.png", "image/png", atCap);
            assertThat(service.uploadAvatar(userId, file)).contains("/avatars/");
        }

        @Test
        void svg_rejected_with_415_outside_allowlist() {
            // SVG excluded — XSS vector via embedded <script>.
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.svg", "image/svg+xml",
                    "<svg/>".getBytes());
            assertThatThrownBy(() -> service.uploadAvatar(userId, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        @Test
        void declared_png_but_bytes_are_jpeg_rejected_415() {
            // Magic-byte mismatch is the file-spoof defence.
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.png", "image/png", JPEG_MAGIC);
            assertThatThrownBy(() -> service.uploadAvatar(userId, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        @Test
        void random_bytes_with_image_mime_rejected_415() {
            // No magic match at all → sniff returns null → 415.
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.png", "image/png",
                    "not an image".getBytes());
            assertThatThrownBy(() -> service.uploadAvatar(userId, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        @Test
        void declared_pdf_rejected_for_avatar_path() {
            // Avatar accepts only the image set; PDF passes the declared
            // mime test for attachments but never for avatars.
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);
            assertThatThrownBy(() -> service.uploadAvatar(userId, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        @Test
        void avatar_does_not_touch_workspace_quota_or_attachment_refs() throws Exception {
            var userId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.png", "image/png", PNG_MAGIC);
            service.uploadAvatar(userId, file);
            verifyNoInteractions(workspaceStorage, projects, attachmentRefs);
        }
    }

    // ── uploadAttachment ──────────────────────────────────────────────

    @Nested
    @DisplayName("uploadAttachment — Happy")
    class AttachmentHappy {

        @Test
        void pdf_upload_increments_quota_then_stores_then_returns_project_scoped_path() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);

            var url = service.uploadAttachment(caller, projectId, null, null, file);

            assertThat(url).startsWith("/media/attachments/" + projectId + "/").endsWith(".pdf");
            verify(workspaceStorage).incrementOrThrow(eq(workspaceId), eq((long) PDF_MAGIC.length));
            verify(storage).store(anyString(), eq(PDF_MAGIC), eq("application/pdf"));
        }

        @Test
        void png_attachment_uses_png_extension_and_stores_image_mime() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "img.png", "image/png", PNG_MAGIC);
            assertThat(service.uploadAttachment(caller, projectId, null, null, file))
                    .endsWith(".png");
        }

        @Test
        void docx_zip_family_keeps_declared_specific_mime_not_generic_zip() throws Exception {
            // Office formats sniff as application/zip — UploadService
            // narrows back to the declared "application/vnd.openxml..."
            // before storing so the served Content-Type matches the
            // file extension.
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            var file = new MockMultipartFile("f", "doc.docx", docx, ZIP_MAGIC);

            var url = service.uploadAttachment(caller, projectId, null, null, file);

            assertThat(url).endsWith(".docx");
            verify(storage).store(anyString(), eq(ZIP_MAGIC), eq(docx));
        }

        @Test
        void plain_zip_keeps_zip_extension() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "a.zip", "application/zip", ZIP_MAGIC);
            assertThat(service.uploadAttachment(caller, projectId, null, null, file))
                    .endsWith(".zip");
        }

        @Test
        void valid_ref_kind_registers_attachment_reference() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var refId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);

            service.uploadAttachment(caller, projectId, "comment", refId, file);

            var pathCap = ArgumentCaptor.forClass(String.class);
            verify(attachmentRefs).register(eq(workspaceId), pathCap.capture(),
                    eq(AttachmentReferenceService.RefKind.comment), eq(refId),
                    eq((long) PDF_MAGIC.length));
            assertThat(pathCap.getValue()).startsWith("attachments/" + projectId + "/");
        }

        @Test
        void quota_increment_runs_before_storage_store_to_avoid_orphan_blob() throws Exception {
            // Critical ordering: a refused upload must not leave an
            // orphan in R2. Tested by verifying invocation order via
            // InOrder so a future refactor can't reorder them.
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);

            service.uploadAttachment(caller, projectId, null, null, file);

            var inOrder = org.mockito.Mockito.inOrder(workspaceStorage, storage);
            inOrder.verify(workspaceStorage).incrementOrThrow(any(), anyLong());
            inOrder.verify(storage).store(anyString(), any(), anyString());
        }
    }

    @Nested
    @DisplayName("uploadAttachment — Edge")
    class AttachmentEdge {

        @Test
        void unrecognised_ref_kind_skips_registration_but_upload_succeeds() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);

            service.uploadAttachment(caller, projectId, "BOGUS_KIND", UUID.randomUUID(), file);

            verify(storage).store(anyString(), any(), anyString());
            verifyNoInteractions(attachmentRefs);
        }

        @Test
        void null_ref_kind_skips_registration() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);
            service.uploadAttachment(caller, projectId, null, UUID.randomUUID(), file);
            verifyNoInteractions(attachmentRefs);
        }

        @Test
        void valid_kind_but_null_ref_id_skips_registration() throws Exception {
            // Both kind AND refId required for register; either alone
            // = unregistered (project-cascade catches the blob later).
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);
            service.uploadAttachment(caller, projectId, "comment", null, file);
            verifyNoInteractions(attachmentRefs);
        }

        @Test
        void exactly_at_50mb_cap_passes() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var atCap = new byte[50 * 1024 * 1024];
            System.arraycopy(PDF_MAGIC, 0, atCap, 0, PDF_MAGIC.length);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", atCap);
            assertThat(service.uploadAttachment(caller, projectId, null, null, file))
                    .endsWith(".pdf");
        }
    }

    @Nested
    @DisplayName("uploadAttachment — Error")
    class AttachmentError {

        @Test
        void over_50mb_throws_413_before_quota_or_storage_touched() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var huge = new byte[50 * 1024 * 1024 + 1];
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", huge);

            assertThatThrownBy(() -> service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
            verifyNoInteractions(workspaceStorage, storage, projects, attachmentRefs);
        }

        @Test
        void empty_file_throws_400_without_touching_dependencies() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", new byte[0]);

            assertThatThrownBy(() -> service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.BAD_REQUEST);
            verifyNoInteractions(workspaceStorage, storage, projects, attachmentRefs);
        }

        @Test
        void exe_outside_allowlist_throws_415() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var file = new MockMultipartFile("f", "evil.exe",
                    "application/x-msdownload", "MZ".getBytes());

            assertThatThrownBy(() -> service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        @Test
        void declared_pdf_with_jpeg_bytes_rejected_415() {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", JPEG_MAGIC);

            assertThatThrownBy(() -> service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
            verifyNoInteractions(workspaceStorage, storage);
        }

        @Test
        void declared_zip_with_pdf_bytes_rejected_no_zip_family_widening() {
            // Zip-family widening is one-way: declared specific docx
            // can pass with sniffed application/zip. The reverse
            // (declared zip, sniffed pdf) must NOT pass.
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var file = new MockMultipartFile("f", "a.zip", "application/zip", PDF_MAGIC);

            assertThatThrownBy(() -> service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(ResponseStatusException.class)
                    .extracting("statusCode").isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        @Test
        void quota_exception_aborts_before_storage_store_no_orphan_blob() throws Exception {
            // The prod incident this test guards: quota exceeded must
            // skip storage.store entirely so R2 doesn't accumulate
            // bytes the workspace's counter never knew about.
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            doThrow(new RuntimeException("quota exceeded"))
                    .when(workspaceStorage).incrementOrThrow(any(), anyLong());
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);

            assertThatThrownBy(() ->
                    service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(RuntimeException.class);
            verify(storage, never()).store(anyString(), any(), anyString());
            verifyNoInteractions(attachmentRefs);
        }

        @Test
        void non_member_project_findById_throws_short_circuits_quota_and_storage() throws Exception {
            // ProjectService.findById gates membership; a non-member
            // gets a thrown exception, and uploadAttachment must
            // propagate it without ever calling quota / storage.
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            when(projects.findById(eq(projectId), eq(caller)))
                    .thenThrow(new RuntimeException("PROJECT_NOT_FOUND"));
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);

            assertThatThrownBy(() ->
                    service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("PROJECT_NOT_FOUND");
            verifyNoInteractions(workspaceStorage, storage, attachmentRefs);
        }

        @Test
        void declared_text_csv_without_signature_still_accepted_by_trust_path() throws Exception {
            // text/csv has no magic bytes; MimeSniffer.detect falls
            // through to "trust declared after allowlist + size gates".
            // This isn't a vulnerability — every other gate has fired.
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            var csv = "col1,col2\n1,2".getBytes();
            var file = new MockMultipartFile("f", "x.csv", "text/csv", csv);

            assertThat(service.uploadAttachment(caller, projectId, null, null, file))
                    .endsWith(".csv");
        }

        @Test
        void storage_io_failure_propagates_to_caller() throws Exception {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProject(projectId, workspaceId, caller);
            doThrow(new IOException("R2 down"))
                    .when(storage).store(anyString(), any(), anyString());
            var file = new MockMultipartFile("f", "x.pdf", "application/pdf", PDF_MAGIC);

            assertThatThrownBy(() ->
                    service.uploadAttachment(caller, projectId, null, null, file))
                    .isInstanceOf(IOException.class);
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private void stubProject(UUID projectId, UUID workspaceId, UUID callerId) {
        var p = new Project(
                projectId, workspaceId, "main", "Main",
                null, callerId,
                OffsetDateTime.now(), OffsetDateTime.now(),
                "1.0");
        when(projects.findById(eq(projectId), eq(callerId))).thenReturn(p);
    }
}

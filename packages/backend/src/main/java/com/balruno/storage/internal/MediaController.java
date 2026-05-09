// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.StorageService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.HandlerMapping;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * Public {@code GET /media/**} that streams blobs out of the active
 * {@link StorageService} adapter. Baserow-pattern serving — clients
 * (and AGPL self-hosters) see the same {@code main-domain/media/...}
 * URL whether the bytes live in R2 or on the local disk; only the
 * operator's deploy config picks one.
 *
 * Cache headers mark the response as immutable for a year — every
 * upload path is content-addressed (SHA-256 prefix) so a re-upload of
 * the same image returns the same URL. CDN cache rules on
 * {@code balruno.com/media/*} can layer on top without invalidation
 * concerns.
 *
 * Auth: open. The upload path itself requires JWT (see
 * {@link UploadController}); served bytes are public reads. Avatar
 * URLs are predictable but not enumerable (UUIDv7 + content hash).
 */
@RestController
@Tag(name = "Media")
@RequestMapping("/media")
class MediaController {

    private final StorageService storage;

    MediaController(StorageService storage) {
        this.storage = storage;
    }

    @GetMapping("/**")
    ResponseEntity<InputStreamResource> serve(HttpServletRequest request) throws IOException {
        var fullPath = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
        if (fullPath == null) fullPath = request.getRequestURI();
        // Strip the controller mapping prefix; the "**" suffix arrives
        // here as the path portion the user requested.
        String key = fullPath.startsWith("/media/") ? fullPath.substring("/media/".length()) : fullPath;
        if (key.isEmpty() || key.contains("..")) {
            return ResponseEntity.notFound().build();
        }
        var maybe = storage.read(key);
        if (maybe.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        var obj = maybe.get();
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(obj.contentType()));
        if (obj.contentLength() >= 0) headers.setContentLength(obj.contentLength());
        headers.setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
        return ResponseEntity.ok()
                .headers(headers)
                .body(new InputStreamResource(obj.content()));
    }
}

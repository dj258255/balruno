// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share.internal;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** 404 surface for the public read endpoint when the token doesn't
 *  resolve, was revoked, or carries a project that has been deleted. */
@ResponseStatus(HttpStatus.NOT_FOUND)
class ShareLinkNotFoundException extends RuntimeException {
    ShareLinkNotFoundException(String message) {
        super(message);
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Returned only at invite creation time. {@code rawToken} is the opaque
 * secret the inviter copies into the share link; the server stores only
 * its SHA-256 hash and never returns the raw value again. Subsequent
 * GETs of the invite expose the metadata via {@link WorkspaceInvite}.
 */
public record CreatedInvite(
        WorkspaceInvite invite,
        String rawToken
) {}

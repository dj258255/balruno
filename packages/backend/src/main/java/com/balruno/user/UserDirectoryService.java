// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * Lookup-only outbound API for sibling modules. Authentication state and
 * mutations live on {@link UserAuthService}; this interface exists so
 * read-side cross-module aggregators (member-list controller, audit-log
 * renderer, presence indicator) can resolve user ids to renderable
 * briefs without depending on the authenticated-session surface.
 *
 * The aggregating modules (e.g. {@code com.balruno.directory}) depend on
 * this interface — never the other way around — so the slice graph stays
 * acyclic under Spring Modulith's verification.
 */
public interface UserDirectoryService {

    /**
     * Batch lookup. Missing ids are simply absent from the returned map
     * (no exception) so callers can render "deleted user" placeholders
     * for dangling foreign keys without a second probe.
     */
    Map<UUID, UserBrief> findBriefsByIds(Collection<UUID> ids);
}

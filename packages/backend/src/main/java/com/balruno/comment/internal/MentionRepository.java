// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

/**
 * Persistence for the mentions table.
 *
 * Insert is native ON CONFLICT DO NOTHING. JpaRepository.save() on
 * an existing composite key would issue UPDATE — that would clobber
 * the {@code notified} flag the notification dispatcher may have
 * already set. ON CONFLICT DO NOTHING keeps the existing row
 * intact, which is the semantic we want for re-edits of a
 * mention-bearing comment.
 */
interface MentionRepository extends JpaRepository<MentionEntity, MentionEntity.MentionId> {

    @Modifying
    @Query(value = "INSERT INTO mentions (comment_id, mentioned_user) "
                 + "VALUES (:commentId, :mentionedUser) "
                 + "ON CONFLICT DO NOTHING",
           nativeQuery = true)
    int insertIgnore(@Param("commentId") UUID commentId,
                     @Param("mentionedUser") UUID mentionedUser);
}

// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

interface UserRepository extends JpaRepository<UserEntity, UUID> {

    /**
     * Case-insensitive email lookup matching the {@code users_email_lower_uk}
     * unique index from V1 — keeps the planner on the index even when callers
     * pass mixed-case input.
     */
    @Query("select u from UserEntity u where lower(u.email) = lower(:email)")
    Optional<UserEntity> findByEmailIgnoreCase(@Param("email") String email);
}

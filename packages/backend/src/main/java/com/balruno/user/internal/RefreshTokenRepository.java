// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {

    Optional<RefreshTokenEntity> findByTokenHash(byte[] tokenHash);

    List<RefreshTokenEntity> findByUserIdAndRevokedAtIsNull(UUID userId);
}

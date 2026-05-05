// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.OAuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface OAuthAccountRepository extends JpaRepository<OAuthAccountEntity, UUID> {

    Optional<OAuthAccountEntity> findByProviderAndProviderUserId(
            OAuthProvider provider, String providerUserId);

    List<OAuthAccountEntity> findByUserId(UUID userId);
}

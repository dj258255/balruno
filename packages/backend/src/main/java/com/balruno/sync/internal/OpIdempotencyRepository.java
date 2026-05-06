// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** PK lookup is the only hot path — handler reads on every op write. */
interface OpIdempotencyRepository extends JpaRepository<OpIdempotencyEntity, UUID> {
}

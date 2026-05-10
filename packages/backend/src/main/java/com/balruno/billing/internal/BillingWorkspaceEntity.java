// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.billing.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * Billing-module view of the {@code workspaces} table.
 *
 * The full {@code @Entity WorkspaceEntity} lives in
 * {@code workspace.internal} (package-private — modulith intentional).
 * The billing module only touches three Stripe fields + plan + the
 * read-only display name / slug, all via raw native SQL inside
 * {@link BillingWorkspaceRepository}. This class exists solely to
 * satisfy {@code Repository<BillingWorkspaceEntity, UUID>} type
 * binding — none of the repo methods load it as a managed entity.
 */
@Entity
@Table(name = "workspaces")
class BillingWorkspaceEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    protected BillingWorkspaceEntity() {} // JPA
}

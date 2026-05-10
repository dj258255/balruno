// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * Sync-module view of the {@code projects} table.
 *
 * The full {@code @Entity ProjectEntity} lives in {@code project.internal}
 * (package-private — modulith intentional). The sync module needs raw
 * native SQL access to the same table for the op-log path
 * (SELECT FOR UPDATE + jsonb_set + version bump) and a managed entity
 * isn't useful here — Hibernate's dirty-checking + optimistic-lock
 * model conflicts with the explicit base-version check the sync ops
 * use, so we avoid loading these as entities altogether.
 *
 * This class exists only to satisfy {@link ProjectSyncRepository}'s
 * type parameter on {@code Repository<ProjectSyncEntity, UUID>}. All
 * methods on the repository are native {@code @Query} — no
 * {@code save}, no {@code findById}, no derived methods — so the entity
 * never needs to participate in JPA's managed lifecycle. Hibernate's
 * boot-time validation only checks that the columns we declare exist
 * on the table.
 */
@Entity
@Table(name = "projects")
class ProjectSyncEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false, insertable = false)
    private UUID id;

    protected ProjectSyncEntity() {} // JPA
}

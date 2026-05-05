// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.Workspace;
import com.balruno.workspace.WorkspaceException;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
class WorkspaceServiceImpl implements WorkspaceService {

    private final WorkspaceRepository workspaceRepo;
    private final WorkspaceMemberRepository memberRepo;

    WorkspaceServiceImpl(WorkspaceRepository workspaceRepo, WorkspaceMemberRepository memberRepo) {
        this.workspaceRepo = workspaceRepo;
        this.memberRepo = memberRepo;
    }

    @Override
    public Workspace create(UUID creatorUserId, String slug, String name) {
        SlugRules.validate(slug);
        if (workspaceRepo.existsBySlugAndDeletedAtIsNull(slug)) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.SLUG_TAKEN,
                    "A workspace with that slug already exists.");
        }
        var entity = saveOrThrow(new WorkspaceEntity(slug, name, creatorUserId));
        memberRepo.save(new WorkspaceMemberEntity(entity.getId(), creatorUserId, WorkspaceRole.OWNER));
        return toDto(entity);
    }

    @Override
    public Workspace createDefaultFor(UUID userId, String preferredSlugBase, String name) {
        var slug = pickAvailableSlug(preferredSlugBase);
        // pickAvailableSlug runs SlugRules.validate internally, so the
        // resulting candidate is guaranteed to be format-valid + non-reserved.
        var entity = saveOrThrow(new WorkspaceEntity(slug, name, userId));
        memberRepo.save(new WorkspaceMemberEntity(entity.getId(), userId, WorkspaceRole.OWNER));
        return toDto(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public Workspace findById(UUID workspaceId) {
        return workspaceRepo.findById(workspaceId)
                .filter(w -> !w.isDeleted())
                .map(WorkspaceServiceImpl::toDto)
                .orElseThrow(() -> new WorkspaceException(
                        WorkspaceException.Reason.WORKSPACE_NOT_FOUND,
                        "Workspace not found."));
    }

    @Override
    @Transactional(readOnly = true)
    public Workspace findBySlug(String slug) {
        return workspaceRepo.findBySlugAndDeletedAtIsNull(slug)
                .map(WorkspaceServiceImpl::toDto)
                .orElseThrow(() -> new WorkspaceException(
                        WorkspaceException.Reason.WORKSPACE_NOT_FOUND,
                        "Workspace not found."));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Workspace> listForUser(UUID userId) {
        var memberships = memberRepo.findByUserId(userId);
        return memberships.stream()
                .map(m -> workspaceRepo.findById(m.getWorkspaceId()).orElse(null))
                .filter(w -> w != null && !w.isDeleted())
                .map(WorkspaceServiceImpl::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public void requireRole(UUID workspaceId, UUID userId, WorkspaceRole minRequired) {
        var membership = memberRepo.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new WorkspaceException(
                        WorkspaceException.Reason.NOT_A_MEMBER,
                        "You are not a member of this workspace."));
        if (!membership.getRole().permits(minRequired)) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.INSUFFICIENT_ROLE,
                    "This action requires " + minRequired + " or higher.");
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private WorkspaceEntity saveOrThrow(WorkspaceEntity entity) {
        try {
            return workspaceRepo.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            // Race fallback — a concurrent insert won the slug's partial
            // unique index. Surface the same SLUG_TAKEN response.
            throw new WorkspaceException(
                    WorkspaceException.Reason.SLUG_TAKEN,
                    "A workspace with that slug already exists.");
        }
    }

    /**
     * Picks the slug for a default workspace: try the preferred base, then
     * append numeric suffixes on collision. Falls back to "workspace" when
     * the preferred input is reserved or fails the format check.
     */
    private String pickAvailableSlug(String preferred) {
        var base = sanitize(preferred);
        if (base == null) {
            base = "workspace";
        }
        if (!workspaceRepo.existsBySlugAndDeletedAtIsNull(base)) {
            return base;
        }
        for (int i = 2; i < 100; i++) {
            var candidate = base + "-" + i;
            if (candidate.length() <= 30
                    && !workspaceRepo.existsBySlugAndDeletedAtIsNull(candidate)) {
                return candidate;
            }
        }
        // 100 collisions is essentially impossible; fall back to a random suffix.
        return (base + "-" + UUID.randomUUID().toString().substring(0, 8))
                .substring(0, Math.min(30, base.length() + 9));
    }

    /**
     * Normalises a free-form preferred string into a slug-shaped value:
     * lowercase, strip non-alnum/hyphen, drop leading hyphens, clamp to 30
     * chars, and run the regex + reserved-word check. Returns null when
     * the input cannot be salvaged.
     */
    private static String sanitize(String preferred) {
        if (preferred == null) return null;
        var lower = preferred.toLowerCase();
        var cleaned = lower.replaceAll("[^a-z0-9-]", "");
        if (cleaned.startsWith("-")) {
            cleaned = cleaned.replaceFirst("^-+", "");
        }
        if (cleaned.length() < 3) return null;
        if (cleaned.length() > 30) cleaned = cleaned.substring(0, 30);
        try {
            SlugRules.validate(cleaned);
            return cleaned;
        } catch (WorkspaceException e) {
            return null;
        }
    }

    private static Workspace toDto(WorkspaceEntity e) {
        return new Workspace(
                e.getId(), e.getSlug(), e.getName(),
                e.getCreatedBy(), e.getCreatedAt(), e.getUpdatedAt());
    }
}

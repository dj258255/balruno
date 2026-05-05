// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.CreatedInvite;
import com.balruno.workspace.Workspace;
import com.balruno.workspace.WorkspaceException;
import com.balruno.workspace.WorkspaceInvite;
import com.balruno.workspace.WorkspaceMember;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
class WorkspaceServiceImpl implements WorkspaceService {

    private static final Duration DEFAULT_INVITE_TTL = Duration.ofDays(7);
    private static final Duration MAX_INVITE_TTL = Duration.ofDays(30);

    private final WorkspaceRepository workspaceRepo;
    private final WorkspaceMemberRepository memberRepo;
    private final WorkspaceInviteRepository inviteRepo;

    WorkspaceServiceImpl(WorkspaceRepository workspaceRepo,
                         WorkspaceMemberRepository memberRepo,
                         WorkspaceInviteRepository inviteRepo) {
        this.workspaceRepo = workspaceRepo;
        this.memberRepo = memberRepo;
        this.inviteRepo = inviteRepo;
    }

    // ── lifecycle ──────────────────────────────────────────────────────

    @Override
    public Workspace create(UUID creatorUserId, String slug, String name) {
        SlugRules.validate(slug);
        if (workspaceRepo.existsBySlugAndDeletedAtIsNull(slug)) {
            throw slugTaken();
        }
        var entity = saveOrThrow(new WorkspaceEntity(slug, name, creatorUserId));
        memberRepo.save(new WorkspaceMemberEntity(entity.getId(), creatorUserId, WorkspaceRole.OWNER));
        return toDto(entity);
    }

    @Override
    public Workspace createDefaultFor(UUID userId, String preferredSlugBase, String name) {
        var slug = pickAvailableSlug(preferredSlugBase);
        var entity = saveOrThrow(new WorkspaceEntity(slug, name, userId));
        memberRepo.save(new WorkspaceMemberEntity(entity.getId(), userId, WorkspaceRole.OWNER));
        return toDto(entity);
    }

    @Override
    public Workspace update(UUID workspaceId, UUID callerUserId, String newSlug, String newName) {
        requireRole(workspaceId, callerUserId, WorkspaceRole.ADMIN);
        var entity = loadActive(workspaceId);
        if (newSlug != null && !newSlug.equals(entity.getSlug())) {
            SlugRules.validate(newSlug);
            if (workspaceRepo.existsBySlugAndDeletedAtIsNull(newSlug)) {
                throw slugTaken();
            }
            entity.changeSlug(newSlug);
        }
        if (newName != null && !newName.isBlank() && !newName.equals(entity.getName())) {
            entity.rename(newName);
        }
        return toDto(saveOrThrow(entity));
    }

    @Override
    public void softDelete(UUID workspaceId, UUID callerUserId) {
        // Owner-only — Admin cannot delete the workspace.
        var membership = memberRepo.findByWorkspaceIdAndUserId(workspaceId, callerUserId)
                .orElseThrow(WorkspaceServiceImpl::notMember);
        if (membership.getRole() != WorkspaceRole.OWNER) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.OWNER_REQUIRED,
                    "Only the Owner can delete a workspace.");
        }
        var entity = loadActive(workspaceId);
        entity.softDelete();
        workspaceRepo.save(entity);
    }

    // ── reads ──────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Workspace findById(UUID workspaceId) {
        return toDto(loadActive(workspaceId));
    }

    @Override
    @Transactional(readOnly = true)
    public Workspace findBySlug(String slug) {
        return workspaceRepo.findBySlugAndDeletedAtIsNull(slug)
                .map(WorkspaceServiceImpl::toDto)
                .orElseThrow(WorkspaceServiceImpl::notFound);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Workspace> listForUser(UUID userId) {
        return memberRepo.findByUserId(userId).stream()
                .map(m -> workspaceRepo.findById(m.getWorkspaceId()).orElse(null))
                .filter(w -> w != null && !w.isDeleted())
                .map(WorkspaceServiceImpl::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceMember> listMembers(UUID workspaceId, UUID callerUserId) {
        requireRole(workspaceId, callerUserId, WorkspaceRole.VIEWER);
        return memberRepo.findByWorkspaceId(workspaceId).stream()
                .map(WorkspaceServiceImpl::toMemberDto)
                .toList();
    }

    // ── member management ─────────────────────────────────────────────

    @Override
    public void removeMember(UUID workspaceId, UUID callerUserId, UUID targetUserId) {
        requireRole(workspaceId, callerUserId, WorkspaceRole.ADMIN);
        var target = memberRepo.findByWorkspaceIdAndUserId(workspaceId, targetUserId)
                .orElseThrow(WorkspaceServiceImpl::notMember);
        if (target.getRole() == WorkspaceRole.OWNER
                && memberRepo.countByWorkspaceIdAndRole(workspaceId, WorkspaceRole.OWNER) <= 1) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.CANNOT_REMOVE_OWNER,
                    "Cannot remove the last Owner — transfer ownership first.");
        }
        memberRepo.delete(target);
    }

    @Override
    public WorkspaceMember changeMemberRole(UUID workspaceId, UUID callerUserId,
                                            UUID targetUserId, WorkspaceRole newRole) {
        requireRole(workspaceId, callerUserId, WorkspaceRole.ADMIN);
        var target = memberRepo.findByWorkspaceIdAndUserId(workspaceId, targetUserId)
                .orElseThrow(WorkspaceServiceImpl::notMember);
        if (target.getRole() == WorkspaceRole.OWNER
                && newRole != WorkspaceRole.OWNER
                && memberRepo.countByWorkspaceIdAndRole(workspaceId, WorkspaceRole.OWNER) <= 1) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.CANNOT_REMOVE_OWNER,
                    "Cannot demote the last Owner — transfer ownership first.");
        }
        target.changeRole(newRole);
        return toMemberDto(memberRepo.save(target));
    }

    // ── invites ────────────────────────────────────────────────────────

    @Override
    public CreatedInvite createInvite(UUID workspaceId, UUID callerUserId,
                                      WorkspaceRole role, Duration expiresIn) {
        requireRole(workspaceId, callerUserId, WorkspaceRole.ADMIN);
        loadActive(workspaceId);
        var assignedRole = role != null ? role : WorkspaceRole.VIEWER;
        if (assignedRole == WorkspaceRole.OWNER) {
            // Ownership is transferred explicitly, never granted via invite.
            throw new WorkspaceException(
                    WorkspaceException.Reason.OWNER_REQUIRED,
                    "OWNER cannot be granted via invite — use ownership transfer.");
        }
        var ttl = (expiresIn == null || expiresIn.isZero() || expiresIn.isNegative())
                ? DEFAULT_INVITE_TTL
                : (expiresIn.compareTo(MAX_INVITE_TTL) > 0 ? MAX_INVITE_TTL : expiresIn);

        var rawToken = SecureToken.generateRaw();
        var entity = new WorkspaceInviteEntity(
                workspaceId,
                callerUserId,
                SecureToken.hash(rawToken),
                assignedRole,
                OffsetDateTime.now(ZoneOffset.UTC).plus(ttl));
        var saved = inviteRepo.saveAndFlush(entity);
        return new CreatedInvite(toInviteDto(saved), rawToken);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceInvite> listInvites(UUID workspaceId, UUID callerUserId) {
        requireRole(workspaceId, callerUserId, WorkspaceRole.ADMIN);
        return inviteRepo.findByWorkspaceIdAndAcceptedAtIsNullAndRevokedAtIsNull(workspaceId).stream()
                .map(WorkspaceServiceImpl::toInviteDto)
                .toList();
    }

    @Override
    public void revokeInvite(UUID workspaceId, UUID callerUserId, UUID inviteId) {
        requireRole(workspaceId, callerUserId, WorkspaceRole.ADMIN);
        var invite = inviteRepo.findById(inviteId)
                .filter(i -> i.getWorkspaceId().equals(workspaceId))
                .orElseThrow(WorkspaceServiceImpl::notFound);
        invite.revoke();
        inviteRepo.save(invite);
    }

    @Override
    public WorkspaceMember acceptInvite(UUID userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.INVITE_REVOKED,
                    "Invite token is missing.");
        }
        var invite = inviteRepo.findByTokenHash(SecureToken.hash(rawToken))
                .orElseThrow(WorkspaceServiceImpl::notFound);
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        if (invite.getRevokedAt() != null) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.INVITE_REVOKED,
                    "Invite has been revoked.");
        }
        if (invite.getAcceptedAt() != null) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.INVITE_ALREADY_USED,
                    "Invite has already been accepted.");
        }
        if (!invite.getExpiresAt().isAfter(now)) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.INVITE_EXPIRED,
                    "Invite has expired.");
        }
        loadActive(invite.getWorkspaceId());

        // Idempotent member creation: if the user is already a member,
        // mark the invite consumed but don't change the existing role —
        // explicit role changes go through changeMemberRole.
        var existing = memberRepo.findByWorkspaceIdAndUserId(invite.getWorkspaceId(), userId);
        var membership = existing.orElseGet(() -> memberRepo.save(
                new WorkspaceMemberEntity(invite.getWorkspaceId(), userId, invite.getRole())));
        invite.markAccepted(userId);
        inviteRepo.save(invite);
        return toMemberDto(membership);
    }

    // ── permissions ───────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public void requireRole(UUID workspaceId, UUID userId, WorkspaceRole minRequired) {
        var membership = memberRepo.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(WorkspaceServiceImpl::notMember);
        if (!membership.getRole().permits(minRequired)) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.INSUFFICIENT_ROLE,
                    "This action requires " + minRequired + " or higher.");
        }
    }

    // ── helpers ────────────────────────────────────────────────────────

    private WorkspaceEntity loadActive(UUID workspaceId) {
        return workspaceRepo.findById(workspaceId)
                .filter(w -> !w.isDeleted())
                .orElseThrow(WorkspaceServiceImpl::notFound);
    }

    private WorkspaceEntity saveOrThrow(WorkspaceEntity entity) {
        try {
            return workspaceRepo.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            throw slugTaken();
        }
    }

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
        return (base + "-" + UUID.randomUUID().toString().substring(0, 8))
                .substring(0, Math.min(30, base.length() + 9));
    }

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

    // ── exception factories ───────────────────────────────────────────

    private static WorkspaceException slugTaken() {
        return new WorkspaceException(
                WorkspaceException.Reason.SLUG_TAKEN,
                "A workspace with that slug already exists.");
    }

    private static WorkspaceException notFound() {
        return new WorkspaceException(
                WorkspaceException.Reason.WORKSPACE_NOT_FOUND,
                "Workspace not found.");
    }

    private static WorkspaceException notMember() {
        return new WorkspaceException(
                WorkspaceException.Reason.NOT_A_MEMBER,
                "You are not a member of this workspace.");
    }

    // ── DTO mapping ───────────────────────────────────────────────────

    private static Workspace toDto(WorkspaceEntity e) {
        return new Workspace(
                e.getId(), e.getSlug(), e.getName(),
                e.getCreatedBy(), e.getCreatedAt(), e.getUpdatedAt());
    }

    private static WorkspaceMember toMemberDto(WorkspaceMemberEntity e) {
        return new WorkspaceMember(e.getWorkspaceId(), e.getUserId(), e.getRole(), e.getJoinedAt());
    }

    private static WorkspaceInvite toInviteDto(WorkspaceInviteEntity e) {
        return new WorkspaceInvite(
                e.getId(), e.getWorkspaceId(), e.getRole(),
                e.getInvitedBy(), e.getExpiresAt(),
                e.getAcceptedAt(), e.getAcceptedBy(), e.getRevokedAt());
    }
}

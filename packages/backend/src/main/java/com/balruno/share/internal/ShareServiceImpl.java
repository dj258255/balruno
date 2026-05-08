// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share.internal;

import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import com.balruno.share.ShareLink;
import com.balruno.share.ShareService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Default {@link ShareService} implementation.
 *
 * Authoring (create / list / revoke) calls into ProjectService.findById
 * which enforces project membership — non-members see a 404 ProjectException
 * instead of an authz error, matching the rest of the app's privacy
 * posture (don't reveal existence of resources to non-members).
 *
 * Public read (token holder) bypasses ProjectService — only the token
 * is the credential. The unauthenticated reader gets the project's
 * canonical state at read time. Once shared, *every* future edit
 * becomes visible until the link is revoked.
 */
@Service
class ShareServiceImpl implements ShareService {

    private final ShareLinkRepository repo;
    private final ProjectService projects;
    private final JdbcTemplate jdbc;

    /** dual-mapper pattern (memory: project_sb4_abstractions). databind
     *  is autowired in SB 4 as tools.jackson; JsonNode lives in fasterxml,
     *  so the local nodeMapper handles tree work for the snapshot
     *  envelope. */
    private final com.fasterxml.jackson.databind.ObjectMapper nodeMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    ShareServiceImpl(ShareLinkRepository repo, ProjectService projects, JdbcTemplate jdbc) {
        this.repo = repo;
        this.projects = projects;
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public ShareLink create(UUID callerUserId, CreateRequest req) {
        // Membership check — non-members get 404 from findById.
        projects.findById(req.projectId(), callerUserId);
        return repo.insert(
                req.projectId(),
                req.sheetId(),
                req.activeView(),
                req.expiresAt(),
                callerUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShareLink> listForProject(UUID callerUserId, UUID projectId) {
        projects.findById(projectId, callerUserId);
        return repo.findByProjectId(projectId);
    }

    @Override
    @Transactional
    public void revoke(UUID callerUserId, UUID linkId) {
        var link = repo.findById(linkId);
        if (link == null) return; // idempotent — already gone
        // Membership check on the parent project.
        projects.findById(link.projectId(), callerUserId);
        repo.revoke(linkId, OffsetDateTime.now());
    }

    @Override
    public PublicReadResult read(UUID token, OffsetDateTime now) {
        var link = repo.findActiveByToken(token);
        if (link == null) {
            throw new ShareLinkNotFoundException("share link not found or revoked");
        }
        if (link.expiresAt() != null && link.expiresAt().isBefore(now)) {
            throw new ShareLinkNotFoundException("share link expired");
        }

        // Fetch the canonical project snapshot directly. We bypass
        // ProjectService.findById on purpose — public reads do not
        // have a JWT, so the membership check would always reject.
        var snapshot = readProjectSnapshot(link.projectId());
        if (snapshot == null) {
            throw new ShareLinkNotFoundException("project deleted");
        }

        // Diagnostic — best effort, errors swallowed inside repo.
        repo.touchLastUsed(link.id(), now);

        return new PublicReadResult(link, snapshot);
    }

    /**
     * Build the JSON envelope: id + name + data + sheetTree + docTree
     * read straight off the projects row. Mirrors the WebSocket
     * sync.full payload so the public viewer can reuse the live
     * sheet renderers unchanged.
     */
    private JsonNode readProjectSnapshot(UUID projectId) {
        try {
            return jdbc.queryForObject(
                    """
                    SELECT id, name, data, sheet_tree, doc_tree,
                           data_version, sheet_tree_version, doc_tree_version
                    FROM projects
                    WHERE id = ? AND deleted_at IS NULL
                    """,
                    (rs, i) -> {
                        ObjectNode out = nodeMapper.createObjectNode();
                        out.put("id", rs.getObject("id", UUID.class).toString());
                        out.put("name", rs.getString("name"));
                        try {
                            out.set("data", nodeMapper.readTree(rs.getString("data")));
                            out.set("sheetTree", nodeMapper.readTree(rs.getString("sheet_tree")));
                            out.set("docTree", nodeMapper.readTree(rs.getString("doc_tree")));
                        } catch (Exception e) {
                            throw new IllegalStateException("malformed project JSON", e);
                        }
                        ObjectNode versions = nodeMapper.createObjectNode();
                        versions.put("data", rs.getLong("data_version"));
                        versions.put("sheetTree", rs.getLong("sheet_tree_version"));
                        versions.put("docTree", rs.getLong("doc_tree_version"));
                        out.set("versions", versions);
                        return (JsonNode) out;
                    },
                    projectId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }
}

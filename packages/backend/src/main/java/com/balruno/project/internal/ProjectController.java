// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Project REST surface. Create / list are scoped to a workspace; the
 * single-resource paths are flat because a project id is globally
 * unique. Authorisation lives in {@link ProjectService} (which delegates
 * to WorkspaceService.requireRole).
 */
@RestController
@Tag(name = "Project")
@SecurityRequirement(name = "bearerAuth")
class ProjectController {

    private final ProjectService projects;

    ProjectController(ProjectService projects) {
        this.projects = projects;
    }

    @PostMapping(path = "/workspaces/{wsId}/projects", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Project create(@AuthenticationPrincipal Jwt jwt,
                   @PathVariable UUID wsId,
                   @RequestBody @Valid CreateRequest body) {
        return projects.create(wsId, callerId(jwt), body.slug(), body.name(), body.description());
    }

    @GetMapping(path = "/workspaces/{wsId}/projects", version = "1")
    List<Project> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId) {
        return projects.listInWorkspace(wsId, callerId(jwt));
    }

    @GetMapping(path = "/projects/{id}", version = "1")
    Project get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return projects.findById(id, callerId(jwt));
    }

    @PatchMapping(path = "/projects/{id}", version = "1")
    Project update(@AuthenticationPrincipal Jwt jwt,
                   @PathVariable UUID id,
                   @RequestBody @Valid UpdateRequest body) {
        return projects.update(id, callerId(jwt), body.slug(), body.name(), body.description());
    }

    @DeleteMapping(path = "/projects/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        projects.softDelete(id, callerId(jwt));
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    record CreateRequest(
            @NotBlank @Size(min = 3, max = 30) String slug,
            @NotBlank @Size(min = 1, max = 120) String name,
            String description) {}

    record UpdateRequest(
            @Size(min = 3, max = 30) String slug,
            @Size(min = 1, max = 120) String name,
            String description) {}
}

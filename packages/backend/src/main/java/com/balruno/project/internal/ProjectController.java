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
import org.springframework.web.bind.annotation.RequestParam;
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
    private final SheetDuplicateService sheetDuplicate;

    ProjectController(ProjectService projects, SheetDuplicateService sheetDuplicate) {
        this.projects = projects;
        this.sheetDuplicate = sheetDuplicate;
    }

    @PostMapping(path = "/workspaces/{wsId}/projects", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    Project create(@AuthenticationPrincipal Jwt jwt,
                   @PathVariable UUID wsId,
                   @RequestParam(name = "withStarterPack", defaultValue = "false")
                       boolean withStarterPack,
                   @RequestParam(name = "locale", required = false) String localeOverride,
                   @RequestBody @Valid CreateRequest body) {
        var caller = callerId(jwt);
        if (withStarterPack) {
            // Seed the full ADR 0020 starter catalog (12 starters in
            // the bundled locale json) instead of the minimal Sheet 1
            // path. Used by the empty-state auto-create on
            // /workspaces and /w/[slug] so the user lands on a
            // populated project the first time they hit those
            // routes — matches the OAuth-callback first-login
            // behaviour for accounts that pre-date the auto-create
            // logic or that deleted their default project.
            //
            // Locale resolution order:
            //   1. ?locale= query param — caller-active UI locale (the
            //      frontend's NEXT_LOCALE cookie); honoured first so
            //      the starter catalogue matches what the user is
            //      currently reading.
            //   2. JWT 'locale' claim — the user record's stored
            //      preference, set at signup.
            //   3. 'ko' fallback — pre-locale tokens.
            var locale = localeOverride;
            if (locale == null || locale.isBlank()) locale = jwt.getClaimAsString("locale");
            if (locale == null || locale.isBlank()) locale = "ko";
            return projects.createWithStarterPack(
                    wsId, caller, body.slug(), body.name(), body.description(), locale);
        }
        return projects.create(wsId, caller, body.slug(), body.name(), body.description());
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

    /**
     * Sidebar drag-drop reorder. Frontend computes a lexorank midpoint
     * between the two siblings the project lands between and POSTs it
     * here; only this single row is updated. listInWorkspace orders
     * by sort_key so the next list fetch reflects the new position.
     */
    @PostMapping(path = "/projects/{id}/position", version = "1")
    Project setPosition(@AuthenticationPrincipal Jwt jwt,
                        @PathVariable UUID id,
                        @RequestBody @Valid PositionRequest body) {
        return projects.updateSortKey(id, callerId(jwt), body.sortKey());
    }

    /**
     * Sidebar 시트 컨텍스트 메뉴의 "복제". Server-side deep-clone — id
     * 들을 모두 새로 부여하고 sheet_tree 의 source 옆에 새 leaf 를 graft
     * 한 뒤 sync.full broadcast 로 peer 동기화. 응답으로 새 sheet id 만
     * 반환하면 클라이언트가 그쪽으로 setCurrentSheet 한다.
     */
    @PostMapping(path = "/projects/{projectId}/sheets/{sheetId}/duplicate", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    DuplicateSheetResponse duplicateSheet(@AuthenticationPrincipal Jwt jwt,
                                          @PathVariable UUID projectId,
                                          @PathVariable UUID sheetId) {
        var newId = sheetDuplicate.duplicate(projectId, callerId(jwt), sheetId);
        return new DuplicateSheetResponse(newId);
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

    record PositionRequest(
            @NotBlank @Size(min = 1, max = 64) String sortKey) {}

    record DuplicateSheetResponse(UUID newSheetId) {}
}

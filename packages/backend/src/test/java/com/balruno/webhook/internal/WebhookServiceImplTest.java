// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.webhook.internal;

import com.balruno.webhook.Webhook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * WebhookServiceImpl unit tests.
 *
 * The HTTP delivery path (deliver / signature / async dispatch) is
 * tested separately under integration — sending real HTTP and
 * verifying receipt requires a sink and is fragile under mocking.
 * Pure unit coverage focuses on the *create-time validation* +
 * *list secret-stripping* paths, which are where security-relevant
 * decisions are made before any bytes leave the process.
 */
@ExtendWith(MockitoExtension.class)
class WebhookServiceImplTest {

    @Mock WebhookRepository repo;
    @InjectMocks WebhookServiceImpl service;

    @Nested
    @DisplayName("create — Happy")
    class CreateHappy {

        @Test
        void valid_https_url_with_known_event_passes_through_to_save() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var saved = newEntity(projectId, "https://hooks.example.com/x",
                    List.of("comment.added"), caller);
            when(repo.save(any())).thenReturn(saved);

            var dto = service.create(caller, projectId,
                    "https://hooks.example.com/x", List.of("comment.added"));

            assertThat(dto.url()).isEqualTo("https://hooks.example.com/x");
            verify(repo).save(any(WebhookEntity.class));
        }

        @Test
        void multiple_known_events_all_accepted() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var events = List.of("comment.added", "mention.created", "row.added");
            when(repo.save(any())).thenReturn(newEntity(projectId, "https://x", events, caller));

            service.create(caller, projectId, "https://x", events);
            verify(repo).save(any());
        }
    }

    @Nested
    @DisplayName("create — Validation Errors")
    class CreateError {

        @Test
        void http_url_rejected_https_required() {
            // HTTPS-only is a security floor — webhooks carry signed
            // payloads and MITM on plain HTTP would leak the workspace's
            // event stream.
            assertThatThrownBy(() -> service.create(UUID.randomUUID(), UUID.randomUUID(),
                    "http://hooks.example.com", List.of("comment.added")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("https");
            verify(repo, never()).save(any());
        }

        @Test
        void null_url_rejected() {
            assertThatThrownBy(() -> service.create(UUID.randomUUID(), UUID.randomUUID(),
                    null, List.of("comment.added")))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(repo, never()).save(any());
        }

        @Test
        void blank_url_rejected() {
            assertThatThrownBy(() -> service.create(UUID.randomUUID(), UUID.randomUUID(),
                    "   ", List.of("comment.added")))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(repo, never()).save(any());
        }

        @Test
        void empty_events_list_rejected() {
            assertThatThrownBy(() -> service.create(UUID.randomUUID(), UUID.randomUUID(),
                    "https://x", List.of()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("at least one event");
        }

        @Test
        void null_events_list_rejected() {
            assertThatThrownBy(() -> service.create(UUID.randomUUID(), UUID.randomUUID(),
                    "https://x", null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void unknown_event_name_rejected_with_offending_name_in_message() {
            // "user.deleted" isn't on the allowlist — the error tells
            // the operator exactly which entry was bad.
            assertThatThrownBy(() -> service.create(UUID.randomUUID(), UUID.randomUUID(),
                    "https://x", List.of("comment.added", "user.deleted")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("user.deleted");
        }
    }

    @Nested
    @DisplayName("listForProject — secret stripping")
    class List_ {

        @Test
        void list_response_strips_secret_field_to_null() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var entity = newEntity(projectId, "https://x",
                    List.of("comment.added"), caller);
            when(repo.findByProjectIdOrderByCreatedAtDesc(eq(projectId)))
                    .thenReturn(List.of(entity));

            var result = service.listForProject(caller, projectId);

            // The DTO reaching list consumers MUST have secret = null
            // even though the entity carries a real UUID. Bug class:
            // accidentally including secrets in audit / response logs.
            assertThat(result).allSatisfy(w -> assertThat(w.secret()).isNull());
        }

        @Test
        void list_preserves_other_fields_through_strip() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var entity = newEntity(projectId, "https://x",
                    List.of("comment.added"), caller);
            when(repo.findByProjectIdOrderByCreatedAtDesc(eq(projectId)))
                    .thenReturn(List.of(entity));

            var result = service.listForProject(caller, projectId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).url()).isEqualTo("https://x");
            assertThat(result.get(0).events()).containsExactly("comment.added");
        }
    }

    @Nested
    @DisplayName("stripSecret — pure helper")
    class StripSecret {

        @Test
        void replaces_secret_uuid_with_null_keeping_everything_else() {
            var original = new Webhook(
                    UUID.randomUUID(), UUID.randomUUID(), "https://x",
                    List.of("comment.added"),
                    UUID.randomUUID(), // ← secret to strip
                    true, OffsetDateTime.now(), 200, null,
                    UUID.randomUUID(), OffsetDateTime.now());

            var stripped = WebhookServiceImpl.stripSecret(original);

            assertThat(stripped.secret()).isNull();
            assertThat(stripped.id()).isEqualTo(original.id());
            assertThat(stripped.url()).isEqualTo(original.url());
            assertThat(stripped.events()).isEqualTo(original.events());
            assertThat(stripped.active()).isEqualTo(original.active());
            assertThat(stripped.lastStatusCode()).isEqualTo(original.lastStatusCode());
        }

        @Test
        void already_null_secret_remains_null_idempotent() {
            var alreadyStripped = new Webhook(
                    UUID.randomUUID(), UUID.randomUUID(), "https://x",
                    List.of("comment.added"), null, true,
                    null, null, null, UUID.randomUUID(), OffsetDateTime.now());
            assertThat(WebhookServiceImpl.stripSecret(alreadyStripped).secret()).isNull();
        }
    }

    @Nested
    @DisplayName("findById / setActive / delete — repo passthroughs")
    class RepoWrappers {

        @Test
        void findById_returns_dto_when_present() {
            var id = UUID.randomUUID();
            var entity = newEntity(UUID.randomUUID(), "https://x",
                    List.of("comment.added"), UUID.randomUUID());
            when(repo.findById(eq(id))).thenReturn(Optional.of(entity));

            assertThat(service.findById(id)).isNotNull();
        }

        @Test
        void findById_returns_null_when_missing() {
            when(repo.findById(any())).thenReturn(Optional.empty());
            assertThat(service.findById(UUID.randomUUID())).isNull();
        }

        @Test
        void setActive_delegates_to_repo() {
            var id = UUID.randomUUID();
            service.setActive(UUID.randomUUID(), id, false);
            verify(repo).setActive(eq(id), eq(false));
        }

        @Test
        void delete_delegates_to_repo() {
            var id = UUID.randomUUID();
            service.delete(UUID.randomUUID(), id);
            verify(repo).deleteById(eq(id));
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private static WebhookEntity newEntity(UUID projectId, String url,
                                            List<String> events, UUID createdBy) {
        try {
            var entity = new WebhookEntity(projectId, url, events, createdBy);
            setField(entity, "id", UUID.randomUUID());
            setField(entity, "secret", UUID.randomUUID());
            setField(entity, "createdAt", OffsetDateTime.now());
            setField(entity, "active", true);
            return entity;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void setField(Object o, String field, Object val) throws Exception {
        var f = o.getClass().getDeclaredField(field);
        f.setAccessible(true);
        f.set(o, val);
    }
}

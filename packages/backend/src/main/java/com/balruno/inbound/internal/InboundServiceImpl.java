// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound.internal;

import com.balruno.events.InboundRowRequestedEvent;
import com.balruno.inbound.InboundService;
import com.balruno.inbound.InboundWebhook;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
class InboundServiceImpl implements InboundService {

    private final InboundRepository repo;
    private final ApplicationEventPublisher events;
    private final GitHubPRMapper githubMapper = new GitHubPRMapper();

    InboundServiceImpl(InboundRepository repo, ApplicationEventPublisher events) {
        this.repo = repo;
        this.events = events;
    }

    @Override
    @Transactional
    public InboundWebhook create(UUID callerUserId, UUID projectId, CreateInput input) {
        validateProvider(input.provider());
        var entity = new InboundWebhookEntity(
                projectId, input.provider(), input.targetSheetId(),
                input.columnMapping(), callerUserId);
        return repo.save(entity).toDto();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InboundWebhook> listForProject(UUID callerUserId, UUID projectId) {
        return repo.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(InboundWebhookEntity::toDto)
                .toList();
    }

    @Override
    public InboundWebhook findById(UUID inboundId) {
        return repo.findById(inboundId).map(InboundWebhookEntity::toDto).orElse(null);
    }

    @Override
    @Transactional
    public void delete(UUID callerUserId, UUID inboundId) {
        repo.deleteById(inboundId);
    }

    @Override
    public ReceiveResult receive(UUID inboundId, String eventType, JsonNode body) {
        var hook = repo.findById(inboundId).map(InboundWebhookEntity::toDto).orElse(null);
        if (hook == null) return new ReceiveResult.Failed("not found");
        if (!hook.active()) return new ReceiveResult.Ignored("inactive");

        var rowId = UUID.randomUUID();
        JsonNode rowJson;
        try {
            rowJson = switch (hook.provider()) {
                case "github" -> githubMapper.mapToRow(eventType, body, hook.columnMapping(), rowId);
                case "generic" -> mapGeneric(body, hook.columnMapping(), rowId);
                default -> null;
            };
        } catch (Exception e) {
            repo.recordReceive(hook.id(), OffsetDateTime.now(), "mapping_failed", e.getMessage());
            return new ReceiveResult.Failed("mapping failed: " + e.getMessage());
        }
        if (rowJson == null) {
            // Mapper rejected the payload (unsupported event etc.).
            repo.recordReceive(hook.id(), OffsetDateTime.now(), "ignored", "unsupported event");
            return new ReceiveResult.Ignored("unsupported event: " + eventType);
        }

        // Fire the event — sync module's listener applies the row.add.
        events.publishEvent(new InboundRowRequestedEvent(
                hook.projectId(), hook.targetSheetId(), hook.createdBy(), rowId, rowJson));
        repo.recordReceive(hook.id(), OffsetDateTime.now(), "ok", null);
        return new ReceiveResult.Accepted(rowId);
    }

    private JsonNode mapGeneric(JsonNode body, JsonNode columnMapping, UUID rowId) {
        // Generic provider treats body as { columnId: value, ... } directly.
        // column_mapping is unused here; the caller is expected to send
        // the row shape as-is. UUIDv4 row id assigned by us.
        var nodeMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var row = nodeMapper.createObjectNode();
        row.put("id", rowId.toString());
        row.set("cells", body == null ? nodeMapper.createObjectNode() : body);
        return row;
    }

    private static void validateProvider(String provider) {
        if (!"github".equals(provider) && !"generic".equals(provider)) {
            throw new IllegalArgumentException("unsupported provider: " + provider);
        }
    }
}

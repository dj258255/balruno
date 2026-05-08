// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Fired by the inbound webhook module when an external POST has
 * been authenticated + parsed and a new row should be appended to
 * a target sheet (ADR 0029).
 *
 * The sync module's SheetCellOpService has the project lock + JSON
 * navigator + version bookkeeping; routing through events keeps
 * inbound from importing sync directly (Spring Modulith ArchitectureTest
 * forbids the inbound → sync edge that would form otherwise).
 *
 * The {@code rowJson} payload is a fully-formed row record:
 *   { "id": "<UUIDv7>", "cells": { "<columnId>": "<value>", ... } }
 */
public record InboundRowRequestedEvent(
        UUID projectId,
        UUID sheetId,
        UUID actorUserId,
        UUID rowId,
        JsonNode rowJson
) {}

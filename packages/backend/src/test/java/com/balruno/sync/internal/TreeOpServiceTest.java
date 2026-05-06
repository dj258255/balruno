// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure tree-walk tests for the cycle-prevention rule that {@code
 * applyTreeMove} relies on. Helpers live in {@link TreeOpService} as
 * package-private static methods so this test exercises the rule
 * without standing up a Spring context, JdbcTemplate, or
 * Testcontainers PG.
 *
 * Coverage = the four code paths in {@code wouldTreeMoveCreateCycle}:
 *   - root drop (newParentId == null) → false
 *   - move under self → true
 *   - move under direct descendant → true
 *   - move under unrelated branch → false
 *   - missing nodeId → false (caller's "node not found" path takes over)
 */
class TreeOpServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Nested
    @DisplayName("tree.move cycle prevention")
    class CyclePrevention {

        @Test
        @DisplayName("root drop never forms a cycle")
        void rootDrop() throws Exception {
            var nodeId = UUID.randomUUID();
            var roots = (ArrayNode) JSON.readTree(
                    "[{\"id\":\"" + nodeId + "\",\"name\":\"a\",\"children\":[]}]");

            assertThat(TreeOpService.wouldTreeMoveCreateCycle(roots, nodeId, null))
                    .isFalse();
        }

        @Test
        @DisplayName("dropping a node under itself creates a cycle")
        void selfDrop() throws Exception {
            var nodeId = UUID.randomUUID();
            var roots = (ArrayNode) JSON.readTree(
                    "[{\"id\":\"" + nodeId + "\",\"name\":\"a\",\"children\":[]}]");

            assertThat(TreeOpService.wouldTreeMoveCreateCycle(roots, nodeId, nodeId))
                    .isTrue();
        }

        @Test
        @DisplayName("dropping a folder under its own descendant creates a cycle")
        void descendantDrop() throws Exception {
            var rootId = UUID.randomUUID();
            var childId = UUID.randomUUID();
            var grandchildId = UUID.randomUUID();
            var roots = (ArrayNode) JSON.readTree(
                    "[{\"id\":\"" + rootId + "\",\"name\":\"root\",\"children\":["
                  + "  {\"id\":\"" + childId + "\",\"name\":\"child\",\"children\":["
                  + "    {\"id\":\"" + grandchildId + "\",\"name\":\"gc\",\"children\":[]}"
                  + "  ]}"
                  + "]}]");

            assertThat(TreeOpService.wouldTreeMoveCreateCycle(roots, rootId, grandchildId))
                    .isTrue();
        }

        @Test
        @DisplayName("dropping a node under an unrelated sibling is allowed")
        void unrelatedBranchDrop() throws Exception {
            var aId = UUID.randomUUID();
            var bId = UUID.randomUUID();
            var roots = (ArrayNode) JSON.readTree(
                    "[{\"id\":\"" + aId + "\",\"name\":\"a\",\"children\":[]},"
                  + " {\"id\":\"" + bId + "\",\"name\":\"b\",\"children\":[]}]");

            assertThat(TreeOpService.wouldTreeMoveCreateCycle(roots, aId, bId))
                    .isFalse();
        }

        @Test
        @DisplayName("unknown nodeId returns false so apply()'s 'node not found' path runs")
        void unknownNode() throws Exception {
            var rootId = UUID.randomUUID();
            var roots = (ArrayNode) JSON.readTree(
                    "[{\"id\":\"" + rootId + "\",\"name\":\"a\",\"children\":[]}]");

            assertThat(TreeOpService.wouldTreeMoveCreateCycle(roots, UUID.randomUUID(), rootId))
                    .isFalse();
        }
    }
}

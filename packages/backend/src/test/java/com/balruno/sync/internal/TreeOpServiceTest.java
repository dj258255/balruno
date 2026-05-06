// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;

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

    @Nested
    @DisplayName("tree.add node payload validation")
    class TreeAddBudget {

        @Test
        @DisplayName("typical leaf passes")
        void singleLeafPasses() throws Exception {
            var node = (ObjectNode) JSON.readTree(
                    "{\"id\":\"" + UUID.randomUUID() + "\",\"name\":\"folder\",\"children\":[]}");

            assertThatNoException().isThrownBy(
                    () -> TreeOpService.validateTreeAddNodeBudget(node));
        }

        @Test
        @DisplayName("non-UUID id is rejected")
        void rejectsNonUuidId() throws Exception {
            var node = (ObjectNode) JSON.readTree(
                    "{\"id\":\"not-a-uuid\",\"name\":\"x\"}");

            assertThatThrownBy(() -> TreeOpService.validateTreeAddNodeBudget(node))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not a valid UUID");
        }

        @Test
        @DisplayName("duplicate id inside the subtree is rejected")
        void rejectsDuplicateIds() throws Exception {
            var dup = UUID.randomUUID();
            var node = (ObjectNode) JSON.readTree(
                    "{\"id\":\"" + dup + "\",\"name\":\"a\",\"children\":["
                  + "  {\"id\":\"" + dup + "\",\"name\":\"b\"}"
                  + "]}");

            assertThatThrownBy(() -> TreeOpService.validateTreeAddNodeBudget(node))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("duplicate id");
        }

        @Test
        @DisplayName("subtree node count over the budget is rejected")
        void rejectsSubtreeOverBudget() throws Exception {
            // Build a chain of 200 nested children (exceeds MAX_TREE_ADD_NODES = 100).
            var sb = new StringBuilder();
            int depth = 200;
            for (int i = 0; i < depth; i++) {
                sb.append("{\"id\":\"")
                  .append(UUID.randomUUID())
                  .append("\",\"name\":\"n").append(i).append("\",\"children\":[");
            }
            for (int i = 0; i < depth; i++) sb.append("]}");
            var node = (ObjectNode) JSON.readTree(sb.toString());

            assertThatThrownBy(() -> TreeOpService.validateTreeAddNodeBudget(node))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("exceeds");
        }

        @Test
        @DisplayName("name longer than the cap is rejected")
        void rejectsLongName() throws Exception {
            var longName = "x".repeat(TreeOpService.MAX_NAME_LENGTH + 1);
            var node = (ObjectNode) JSON.readTree(
                    "{\"id\":\"" + UUID.randomUUID() + "\",\"name\":\"" + longName + "\"}");

            assertThatThrownBy(() -> TreeOpService.validateTreeAddNodeBudget(node))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("name");
        }
    }

    @Nested
    @DisplayName("tree.rename newName validation")
    class TreeRenameValidation {

        @Test
        @DisplayName("typical name passes")
        void typicalNamePasses() {
            assertThatNoException().isThrownBy(
                    () -> TreeOpService.validateRenameNewName("새 이름"));
        }

        @Test
        @DisplayName("blank name is rejected")
        void rejectsBlank() {
            assertThatThrownBy(() -> TreeOpService.validateRenameNewName("   "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("blank");
        }

        @Test
        @DisplayName("null name is rejected")
        void rejectsNull() {
            assertThatThrownBy(() -> TreeOpService.validateRenameNewName(null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("name longer than the cap is rejected")
        void rejectsLong() {
            var longName = "x".repeat(TreeOpService.MAX_NAME_LENGTH + 1);
            assertThatThrownBy(() -> TreeOpService.validateRenameNewName(longName))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("exceeds");
        }
    }
}

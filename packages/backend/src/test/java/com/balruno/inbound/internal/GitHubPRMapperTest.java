// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.inbound.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic tests for the GitHub webhook → row mapper. The mapper
 * has no Spring deps so the suite can probe edge cases (merged-vs-
 * closed disambiguation, missing entity, missing column mapping)
 * without standing up a Spring context.
 */
class GitHubPRMapperTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private final GitHubPRMapper mapper = new GitHubPRMapper();

    @Nested
    @DisplayName("happy paths")
    class Happy {

        @Test
        void pull_request_opened_maps_to_row_with_title_url_state() throws Exception {
            var payload = JSON.readTree("""
                {
                  "action": "opened",
                  "pull_request": {
                    "title": "Add login flow",
                    "html_url": "https://github.com/x/y/pull/42",
                    "state": "open"
                  }
                }
                """);
            var mapping = JSON.readTree("""
                {"title":"col-title","url":"col-url","status":"col-status"}
                """);
            var rowId = UUID.randomUUID();

            var row = mapper.mapToRow("pull_request", payload, mapping, rowId);

            assertThat(row.get("id").asText()).isEqualTo(rowId.toString());
            assertThat(row.get("cells").get("col-title").asText()).isEqualTo("Add login flow");
            assertThat(row.get("cells").get("col-url").asText())
                    .isEqualTo("https://github.com/x/y/pull/42");
            assertThat(row.get("cells").get("col-status").asText()).isEqualTo("open");
        }

        @Test
        void issue_opened_maps_same_as_pull_request() throws Exception {
            var payload = JSON.readTree("""
                {
                  "action": "opened",
                  "issue": {
                    "title": "Bug in checkout",
                    "html_url": "https://github.com/x/y/issues/7",
                    "state": "open"
                  }
                }
                """);
            var mapping = JSON.readTree("""
                {"title":"t","url":"u","status":"s"}
                """);

            var row = mapper.mapToRow("issues", payload, mapping, UUID.randomUUID());

            assertThat(row.get("cells").get("t").asText()).isEqualTo("Bug in checkout");
            assertThat(row.get("cells").get("s").asText()).isEqualTo("open");
        }

        @Test
        void closed_pr_with_merged_true_surfaces_status_as_merged() throws Exception {
            // GitHub: state=closed + merged=true means "merged"; we
            // promote that to a third status value so users can
            // distinguish from a reject-close in the sheet.
            var payload = JSON.readTree("""
                {
                  "action": "closed",
                  "pull_request": {
                    "title": "Patch",
                    "html_url": "https://github.com/x/y/pull/9",
                    "state": "closed",
                    "merged": true
                  }
                }
                """);
            var mapping = JSON.readTree("""
                {"title":"t","url":"u","status":"s"}
                """);

            var row = mapper.mapToRow("pull_request", payload, mapping, UUID.randomUUID());

            assertThat(row.get("cells").get("s").asText()).isEqualTo("merged");
        }

        @Test
        void closed_pr_with_merged_false_keeps_state_as_closed() throws Exception {
            var payload = JSON.readTree("""
                {
                  "action": "closed",
                  "pull_request": {
                    "title": "Rejected",
                    "html_url": "https://github.com/x/y/pull/10",
                    "state": "closed",
                    "merged": false
                  }
                }
                """);
            var mapping = JSON.readTree("""
                {"status":"s"}
                """);

            var row = mapper.mapToRow("pull_request", payload, mapping, UUID.randomUUID());

            assertThat(row.get("cells").get("s").asText()).isEqualTo("closed");
        }
    }

    @Nested
    @DisplayName("edge cases")
    class Edge {

        @Test
        void payload_without_pr_or_issue_returns_null() throws Exception {
            var payload = JSON.readTree("""
                {"action": "ping", "zen": "Speak like a human."}
                """);
            assertThat(mapper.mapToRow("ping", payload, null, UUID.randomUUID())).isNull();
        }

        @Test
        void missing_title_uses_no_title_sentinel() throws Exception {
            var payload = JSON.readTree("""
                {
                  "action": "opened",
                  "pull_request": {
                    "html_url": "https://github.com/x/y/pull/1",
                    "state": "open"
                  }
                }
                """);
            var mapping = JSON.readTree("""
                {"title":"t"}
                """);

            var row = mapper.mapToRow("pull_request", payload, mapping, UUID.randomUUID());

            assertThat(row.get("cells").get("t").asText()).isEqualTo("(no title)");
        }

        @Test
        void null_mapping_falls_back_to_unmapped_diagnostic_cell() throws Exception {
            // No column mapping → row still produced with a single
            // diagnostic cell so the user sees something is happening
            // and can fix the mapping config.
            var payload = JSON.readTree("""
                {
                  "action": "opened",
                  "pull_request": {
                    "title": "Test PR",
                    "html_url": "https://github.com/x/y/pull/1",
                    "state": "open"
                  }
                }
                """);

            var row = mapper.mapToRow("pull_request", payload, null, UUID.randomUUID());

            assertThat(row.get("cells").get("__github_unmapped").asText())
                    .contains("Test PR")
                    .contains("opened");
        }

        @Test
        void partial_mapping_only_fills_provided_columns() throws Exception {
            // Mapping has title but not url/status — only title cell appears.
            var payload = JSON.readTree("""
                {
                  "action": "opened",
                  "issue": {
                    "title": "X",
                    "html_url": "https://example.com/issue",
                    "state": "open"
                  }
                }
                """);
            var mapping = JSON.readTree("""
                {"title":"t-col"}
                """);

            var row = mapper.mapToRow("issues", payload, mapping, UUID.randomUUID());
            var cells = row.get("cells");

            assertThat(cells.has("t-col")).isTrue();
            assertThat(cells.size()).isEqualTo(1);
        }

        @Test
        void mapping_with_null_value_for_a_key_treats_as_missing() throws Exception {
            var payload = JSON.readTree("""
                {
                  "action": "opened",
                  "issue": {
                    "title": "X",
                    "html_url": "https://example.com",
                    "state": "open"
                  }
                }
                """);
            var mapping = JSON.readTree("""
                {"title":"t-col","url":null,"status":null}
                """);

            var row = mapper.mapToRow("issues", payload, mapping, UUID.randomUUID());
            assertThat(row.get("cells").size()).isEqualTo(1);
            assertThat(row.get("cells").has("t-col")).isTrue();
        }
    }
}

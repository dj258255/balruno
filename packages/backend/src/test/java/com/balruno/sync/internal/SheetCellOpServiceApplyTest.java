// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.sync.SyncMessage;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * SheetCellOpService.apply* unit tests — pure JSON-tree mutation
 * verification with no Spring / DB / event publishing involved.
 *
 * Method visibility was uplifted from private → package-private
 * (TreeOpService follows the same pattern with wouldTreeMoveCreateCycle)
 * so this test exercises each op type in isolation:
 *
 *   - cell.update → cells map writes, legacy array → map conversion
 *   - row.add / delete / move → array operations + idempotency
 *   - column.add / update / delete → array operations + cascade cells
 *   - sheet.metadata.update → partial patch merge with rows/columns guard
 *   - cellStyle.update → row.cellStyles map create-on-first-write
 *
 * The SUT is constructed with all-null deps because apply* methods
 * touch only the in-memory ObjectNode (nodeMapper is local-final).
 */
class SheetCellOpServiceApplyTest {

    private SheetCellOpService service;

    @BeforeEach
    void setUp() {
        // null deps — apply* methods don't touch jdbc / idempotency /
        // json / afterCommit / limitGuard. The local nodeMapper field
        // is final + initialised in the field declaration so it works
        // even without Spring lifecycle.
        service = new SheetCellOpService(null, null, null, null, null);
    }

    // ── cell.update ───────────────────────────────────────────────────

    @Nested
    @DisplayName("cell.update")
    class CellUpdate {

        @Test
        void writes_value_into_cells_map_under_columnId() {
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes", List.of(
                    row(rowId, Map.of(colId, "old"))));

            service.applyCellUpdate(data, new SyncMessage.CellUpdate(
                    sheetId, rowId, colId, "new", 1L, UUID.randomUUID()));

            assertThat(getCellValue(data, sheetId, rowId, colId)).isEqualTo("new");
        }

        @Test
        void unknown_row_throws_with_clear_message() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes", List.of());

            assertThatThrownBy(() -> service.applyCellUpdate(data,
                    new SyncMessage.CellUpdate(
                            sheetId, UUID.randomUUID(), UUID.randomUUID(),
                            "x", 1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("row not found");
        }

        @Test
        void unknown_sheet_throws_with_clear_message() {
            var data = dataWithSheet(UUID.randomUUID(), "S", List.of());

            assertThatThrownBy(() -> service.applyCellUpdate(data,
                    new SyncMessage.CellUpdate(
                            UUID.randomUUID(), UUID.randomUUID(),
                            UUID.randomUUID(), "x", 1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("sheet not found");
        }

        @Test
        void legacy_array_shape_cells_converts_to_map_on_first_write() {
            // V10 seeded `cells: []` for empty rows. First cell.update
            // converts the row's cells from array → map without
            // losing prior values (which were always empty by design).
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes", List.of());
            // Insert legacy row manually — cells is empty array.
            var sheets = (ArrayNode) data.get("sheets");
            var rows = (ArrayNode) sheets.get(0).get("rows");
            var legacyRow = data.objectNode();
            legacyRow.put("id", rowId.toString());
            legacyRow.set("cells", data.arrayNode());
            rows.add(legacyRow);

            service.applyCellUpdate(data, new SyncMessage.CellUpdate(
                    sheetId, rowId, colId, "first", 1L, UUID.randomUUID()));

            assertThat(getCellValue(data, sheetId, rowId, colId)).isEqualTo("first");
        }

        @Test
        void overwriting_same_cell_keeps_only_latest_value() {
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes", List.of(row(rowId, Map.of())));

            service.applyCellUpdate(data, new SyncMessage.CellUpdate(
                    sheetId, rowId, colId, "first", 1L, UUID.randomUUID()));
            service.applyCellUpdate(data, new SyncMessage.CellUpdate(
                    sheetId, rowId, colId, "second", 2L, UUID.randomUUID()));

            assertThat(getCellValue(data, sheetId, rowId, colId)).isEqualTo("second");
        }
    }

    // ── row.add ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("row.add")
    class RowAdd {

        @Test
        void appends_row_to_end_of_sheet_rows() {
            var sheetId = UUID.randomUUID();
            var existingId = UUID.randomUUID();
            var newId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes",
                    List.of(row(existingId, Map.of())));

            service.applyRowAdd(data, new SyncMessage.RowAdd(
                    sheetId, rowMap(newId, Map.of()), 1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.size()).isEqualTo(2);
            assertThat(rows.get(1).get("id").asText()).isEqualTo(newId.toString());
        }

        @Test
        void duplicate_row_id_drops_silently_idempotent() {
            // Same id twice — second one is a no-op so the array stays
            // single-entry. Defends against rare clientMsgId collision
            // where idempotency cache misses but row id repeats.
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes",
                    List.of(row(rowId, Map.of())));

            service.applyRowAdd(data, new SyncMessage.RowAdd(
                    sheetId, rowMap(rowId, Map.of()), 1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.size()).isEqualTo(1);
        }

        @Test
        void payload_without_id_throws_clear_message() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S", List.of());

            assertThatThrownBy(() -> service.applyRowAdd(data,
                    new SyncMessage.RowAdd(
                            sheetId, Map.of("cells", Map.of()),
                            1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("must be an object with id");
        }
    }

    // ── row.delete ────────────────────────────────────────────────────

    @Nested
    @DisplayName("row.delete")
    class RowDelete {

        @Test
        void removes_row_with_matching_id() {
            var sheetId = UUID.randomUUID();
            var rowA = UUID.randomUUID();
            var rowB = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S",
                    List.of(row(rowA, Map.of()), row(rowB, Map.of())));

            service.applyRowDelete(data, new SyncMessage.RowDelete(
                    sheetId, rowA, 1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.size()).isEqualTo(1);
            assertThat(rows.get(0).get("id").asText()).isEqualTo(rowB.toString());
        }

        @Test
        void unknown_row_id_no_op() {
            // Idempotent — deleting an already-deleted row succeeds
            // silently so two clients clicking delete don't error
            // on the second call.
            var sheetId = UUID.randomUUID();
            var rowA = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S",
                    List.of(row(rowA, Map.of())));

            service.applyRowDelete(data, new SyncMessage.RowDelete(
                    sheetId, UUID.randomUUID(), 1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.size()).isEqualTo(1);
        }
    }

    // ── row.move ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("row.move")
    class RowMove {

        @Test
        void moves_row_from_index_2_to_index_0() {
            var sheetId = UUID.randomUUID();
            var rA = UUID.randomUUID();
            var rB = UUID.randomUUID();
            var rC = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S",
                    List.of(row(rA, Map.of()), row(rB, Map.of()), row(rC, Map.of())));

            service.applyRowMove(data, new SyncMessage.RowMove(
                    sheetId, rC, 0, 1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.get(0).get("id").asText()).isEqualTo(rC.toString());
            assertThat(rows.get(1).get("id").asText()).isEqualTo(rA.toString());
            assertThat(rows.get(2).get("id").asText()).isEqualTo(rB.toString());
        }

        @Test
        void to_index_above_size_clamps_to_last_position() {
            // Stale view — client thinks there are 99 rows, server has
            // 3. Clamping prevents an exception while still reflecting
            // the user's intent (move to bottom).
            var sheetId = UUID.randomUUID();
            var rA = UUID.randomUUID();
            var rB = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S",
                    List.of(row(rA, Map.of()), row(rB, Map.of())));

            service.applyRowMove(data, new SyncMessage.RowMove(
                    sheetId, rA, 99, 1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.get(rows.size() - 1).get("id").asText()).isEqualTo(rA.toString());
        }

        @Test
        void to_index_at_current_position_is_noop() {
            var sheetId = UUID.randomUUID();
            var rA = UUID.randomUUID();
            var rB = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S",
                    List.of(row(rA, Map.of()), row(rB, Map.of())));

            service.applyRowMove(data, new SyncMessage.RowMove(
                    sheetId, rA, 0, 1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.get(0).get("id").asText()).isEqualTo(rA.toString());
        }

        @Test
        void unknown_row_throws() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S", List.of(row(UUID.randomUUID(), Map.of())));

            assertThatThrownBy(() -> service.applyRowMove(data,
                    new SyncMessage.RowMove(sheetId, UUID.randomUUID(), 0, 1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("row not found");
        }
    }

    // ── column.add / update / delete ──────────────────────────────────

    @Nested
    @DisplayName("column.add")
    class ColumnAdd {

        @Test
        void appends_column_to_sheet() {
            var sheetId = UUID.randomUUID();
            var newColId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S", List.of());

            service.applyColumnAdd(data, new SyncMessage.ColumnAdd(
                    sheetId, columnMap(newColId, "ATK", "general"),
                    1L, UUID.randomUUID()));

            var cols = (ArrayNode) data.get("sheets").get(0).get("columns");
            assertThat(cols.size()).isEqualTo(1);
            assertThat(cols.get(0).get("id").asText()).isEqualTo(newColId.toString());
            assertThat(cols.get(0).get("name").asText()).isEqualTo("ATK");
            assertThat(cols.get(0).get("type").asText()).isEqualTo("general");
        }

        @Test
        void duplicate_column_id_drops_silently() {
            var sheetId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var data = dataWithSheetAndColumns(sheetId, "S",
                    List.of(columnMap(colId, "ATK", "general")));

            service.applyColumnAdd(data, new SyncMessage.ColumnAdd(
                    sheetId, columnMap(colId, "ATK", "general"),
                    1L, UUID.randomUUID()));

            var cols = (ArrayNode) data.get("sheets").get(0).get("columns");
            assertThat(cols.size()).isEqualTo(1);
        }

        @Test
        void payload_without_id_throws() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S", List.of());

            assertThatThrownBy(() -> service.applyColumnAdd(data,
                    new SyncMessage.ColumnAdd(sheetId, Map.of("name", "X"),
                            1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("must be an object with id");
        }
    }

    @Nested
    @DisplayName("column.update")
    class ColumnUpdate {

        @Test
        void merges_patch_fields_keeping_id_and_other_fields() {
            // Partial patch — only `name` and `width` arrive, other
            // existing fields (type, exportName) stay untouched.
            var sheetId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var existing = new LinkedHashMap<String, Object>();
            existing.put("id", colId.toString());
            existing.put("name", "ATK");
            existing.put("type", "general");
            existing.put("exportName", "atk");
            var data = dataWithSheetAndColumns(sheetId, "S", List.of(existing));

            service.applyColumnUpdate(data, new SyncMessage.ColumnUpdate(
                    sheetId, colId, Map.of("name", "Attack", "width", 200),
                    1L, UUID.randomUUID()));

            var col = ((ArrayNode) data.get("sheets").get(0).get("columns")).get(0);
            assertThat(col.get("name").asText()).isEqualTo("Attack");
            assertThat(col.get("width").asInt()).isEqualTo(200);
            assertThat(col.get("type").asText()).isEqualTo("general"); // untouched
            assertThat(col.get("exportName").asText()).isEqualTo("atk"); // untouched
        }

        @Test
        void patch_id_field_silently_ignored_to_prevent_rekey() {
            // Letting the patch overwrite id would orphan every cell
            // pointer. Defence-in-depth — drop the id field even if
            // a misbehaving client sends it.
            var sheetId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var maliciousId = UUID.randomUUID();
            var data = dataWithSheetAndColumns(sheetId, "S",
                    List.of(columnMap(colId, "ATK", "general")));

            service.applyColumnUpdate(data, new SyncMessage.ColumnUpdate(
                    sheetId, colId,
                    Map.of("id", maliciousId.toString(), "name", "Renamed"),
                    1L, UUID.randomUUID()));

            var col = ((ArrayNode) data.get("sheets").get(0).get("columns")).get(0);
            assertThat(col.get("id").asText()).isEqualTo(colId.toString());
            assertThat(col.get("name").asText()).isEqualTo("Renamed");
        }

        @Test
        void unknown_column_id_throws() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheetAndColumns(sheetId, "S",
                    List.of(columnMap(UUID.randomUUID(), "X", "general")));

            assertThatThrownBy(() -> service.applyColumnUpdate(data,
                    new SyncMessage.ColumnUpdate(
                            sheetId, UUID.randomUUID(),
                            Map.of("name", "Y"), 1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("column not found");
        }
    }

    @Nested
    @DisplayName("column.delete")
    class ColumnDelete {

        @Test
        void removes_column_and_cascades_cell_values_in_every_row() {
            // Critical invariant: deleting a column must drop every
            // row's cell value for that columnId. Leaving them behind
            // would leak the column data + break sheet rendering.
            var sheetId = UUID.randomUUID();
            var colA = UUID.randomUUID();
            var colB = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var data = dataWithSheetAndColumns(sheetId, "S",
                    List.of(columnMap(colA, "A", "general"),
                            columnMap(colB, "B", "general")));
            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            rows.add(rowMapNode(data, rowId, Map.of(colA, "valA", colB, "valB")));

            service.applyColumnDelete(data, new SyncMessage.ColumnDelete(
                    sheetId, colA, 1L, UUID.randomUUID()));

            var cols = (ArrayNode) data.get("sheets").get(0).get("columns");
            assertThat(cols.size()).isEqualTo(1);
            assertThat(cols.get(0).get("id").asText()).isEqualTo(colB.toString());
            // Cascade: row's cells for colA gone, colB intact.
            var cells = (ObjectNode) rows.get(0).get("cells");
            assertThat(cells.has(colA.toString())).isFalse();
            assertThat(cells.get(colB.toString()).asText()).isEqualTo("valB");
        }

        @Test
        void unknown_column_no_op_safe() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheetAndColumns(sheetId, "S",
                    List.of(columnMap(UUID.randomUUID(), "X", "general")));

            service.applyColumnDelete(data, new SyncMessage.ColumnDelete(
                    sheetId, UUID.randomUUID(), 1L, UUID.randomUUID()));

            var cols = (ArrayNode) data.get("sheets").get(0).get("columns");
            assertThat(cols.size()).isEqualTo(1);
        }
    }

    // ── sheet.metadata.update ─────────────────────────────────────────

    @Nested
    @DisplayName("sheet.metadata.update")
    class SheetMetadata {

        @Test
        void overlays_keys_present_keeping_others() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes", List.of());

            service.applySheetMetadataUpdate(data, new SyncMessage.SheetMetadataUpdate(
                    sheetId, Map.of("activeView", "kanban", "icon", "shield"),
                    1L, UUID.randomUUID()));

            var sheet = (ObjectNode) data.get("sheets").get(0);
            assertThat(sheet.get("activeView").asText()).isEqualTo("kanban");
            assertThat(sheet.get("icon").asText()).isEqualTo("shield");
            assertThat(sheet.get("name").asText()).isEqualTo("Heroes"); // preserved
        }

        @Test
        void ignores_protected_keys_rows_columns_id() {
            // The wire op is meant for view metadata only — protect
            // rows/columns/id from accidental overwrite even if a
            // misbehaving client tries.
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "Heroes",
                    List.of(row(UUID.randomUUID(), Map.of())));

            service.applySheetMetadataUpdate(data, new SyncMessage.SheetMetadataUpdate(
                    sheetId, Map.of(
                            "id", UUID.randomUUID().toString(),
                            "rows", List.of(),
                            "columns", List.of(),
                            "activeView", "calendar"),
                    1L, UUID.randomUUID()));

            var sheet = (ObjectNode) data.get("sheets").get(0);
            // id NOT changed
            assertThat(sheet.get("id").asText()).isEqualTo(sheetId.toString());
            // rows NOT replaced
            assertThat(sheet.get("rows").size()).isEqualTo(1);
            // activeView IS applied
            assertThat(sheet.get("activeView").asText()).isEqualTo("calendar");
        }

        @Test
        void non_object_patch_throws() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S", List.of());

            assertThatThrownBy(() -> service.applySheetMetadataUpdate(data,
                    new SyncMessage.SheetMetadataUpdate(
                            sheetId, "not an object", 1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("must be an object");
        }
    }

    // ── cellStyle.update ──────────────────────────────────────────────

    @Nested
    @DisplayName("cellStyle.update")
    class CellStyleUpdate {

        @Test
        void writes_full_style_object_under_columnId_in_cellStyles_map() {
            // Frontend has merged the partial patch with prior style +
            // DEFAULT_CELL_STYLE — server stores the *full* object
            // verbatim. No partial-merge logic on this side.
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S",
                    List.of(row(rowId, Map.of())));

            service.applyCellStyleUpdate(data, new SyncMessage.CellStyleUpdate(
                    sheetId, rowId, colId,
                    Map.of("bold", true, "fontColor", "#ff0000"),
                    1L, UUID.randomUUID()));

            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            var styles = (ObjectNode) rows.get(0).get("cellStyles");
            var style = (ObjectNode) styles.get(colId.toString());
            assertThat(style.get("bold").asBoolean()).isTrue();
            assertThat(style.get("fontColor").asText()).isEqualTo("#ff0000");
        }

        @Test
        void creates_cellStyles_map_when_absent_first_style_per_row() {
            // Older rows might not have a cellStyles field. First
            // style write creates the map; subsequent writes reuse it.
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S",
                    List.of(row(rowId, Map.of())));
            // Ensure no cellStyles initially.
            var rows = (ArrayNode) data.get("sheets").get(0).get("rows");
            assertThat(rows.get(0).has("cellStyles")).isFalse();

            service.applyCellStyleUpdate(data, new SyncMessage.CellStyleUpdate(
                    sheetId, rowId, colId, Map.of("bold", true),
                    1L, UUID.randomUUID()));

            assertThat(rows.get(0).has("cellStyles")).isTrue();
        }

        @Test
        void unknown_row_throws() {
            var sheetId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S", List.of());

            assertThatThrownBy(() -> service.applyCellStyleUpdate(data,
                    new SyncMessage.CellStyleUpdate(
                            sheetId, UUID.randomUUID(), UUID.randomUUID(),
                            Map.of(), 1L, UUID.randomUUID())))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("row not found");
        }
    }

    // ── applyToData dispatch ─────────────────────────────────────────

    @Nested
    @DisplayName("applyToData dispatch")
    class Dispatch {

        @Test
        void delegates_cell_update_to_apply_cell_update() {
            // Smoke: dispatch reaches the right arm. We verify by
            // observing the side effect on `data`.
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            var colId = UUID.randomUUID();
            var data = dataWithSheet(sheetId, "S", List.of(row(rowId, Map.of())));

            service.applyToData(data, new SyncMessage.CellUpdate(
                    sheetId, rowId, colId, "via dispatch", 1L, UUID.randomUUID()));

            assertThat(getCellValue(data, sheetId, rowId, colId)).isEqualTo("via dispatch");
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private ObjectNode dataWithSheet(UUID sheetId, String name, List<Map<String, Object>> rows) {
        return dataWithSheetAndColumns(sheetId, name, List.of(), rows);
    }

    private ObjectNode dataWithSheetAndColumns(UUID sheetId, String name,
                                                List<Map<String, Object>> columns) {
        return dataWithSheetAndColumns(sheetId, name, columns, List.of());
    }

    private ObjectNode dataWithSheetAndColumns(UUID sheetId, String name,
                                                List<Map<String, Object>> columns,
                                                List<Map<String, Object>> rows) {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var data = mapper.createObjectNode();
        var sheets = data.putArray("sheets");
        var sheet = sheets.addObject();
        sheet.put("id", sheetId.toString());
        sheet.put("name", name);
        var colsArr = sheet.putArray("columns");
        for (var col : columns) {
            colsArr.add(mapper.valueToTree(col));
        }
        var rowsArr = sheet.putArray("rows");
        for (var row : rows) {
            rowsArr.add(mapper.valueToTree(row));
        }
        return data;
    }

    private static Map<String, Object> row(UUID id, Map<UUID, Object> cells) {
        var m = new LinkedHashMap<String, Object>();
        m.put("id", id.toString());
        var cellsMap = new LinkedHashMap<String, Object>();
        cells.forEach((k, v) -> cellsMap.put(k.toString(), v));
        m.put("cells", cellsMap);
        return m;
    }

    private static Map<String, Object> rowMap(UUID id, Map<UUID, Object> cells) {
        return row(id, cells);
    }

    private static Map<String, Object> columnMap(UUID id, String name, String type) {
        var m = new LinkedHashMap<String, Object>();
        m.put("id", id.toString());
        m.put("name", name);
        m.put("type", type);
        return m;
    }

    /** Build a Jackson row node directly with cells pre-populated. */
    private static ObjectNode rowMapNode(ObjectNode parent, UUID id, Map<UUID, Object> cells) {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var row = mapper.createObjectNode();
        row.put("id", id.toString());
        var cellMap = row.putObject("cells");
        cells.forEach((k, v) -> cellMap.put(k.toString(), String.valueOf(v)));
        return row;
    }

    private static String getCellValue(ObjectNode data, UUID sheetId, UUID rowId, UUID colId) {
        var sheets = (ArrayNode) data.get("sheets");
        for (var sheet : sheets) {
            if (sheetId.toString().equals(sheet.path("id").asText())) {
                for (var row : sheet.path("rows")) {
                    if (rowId.toString().equals(row.path("id").asText())) {
                        return row.path("cells").path(colId.toString()).asText();
                    }
                }
            }
        }
        return null;
    }
}

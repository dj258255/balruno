/**
 * Yjs Y.Doc 관리 — Track 0 Yjs 마이그레이션의 핵심.
 *
 * 설계 원칙:
 * - 프로젝트당 1개의 Y.Doc
 * - y-indexeddb provider 가 자동 persistence (`balruno-ydoc-{projectId}` DB)
 * - 외부 인터페이스는 Project 타입 기반 (하위호환 유지)
 * - 후속 트랙에서 점진적으로 Y.Doc 을 직접 구독하도록 전환
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Project, Sheet, Column, Row, CellValue, CellStyle, Sticker, Folder } from '@/types';

/** 프로젝트별 Y.Doc 캐시 (메모리 중복 방지) */
const docCache = new Map<string, Y.Doc>();
const providerCache = new Map<string, IndexeddbPersistence>();

/**
 * 프로젝트 ID 기반 Y.Doc 인스턴스 획득 (캐시됨).
 * 동일 ID 로 여러 번 호출해도 같은 Doc 반환.
 */
export function getProjectDoc(projectId: string): Y.Doc {
  let doc = docCache.get(projectId);
  if (!doc) {
    doc = new Y.Doc();
    docCache.set(projectId, doc);
  }
  return doc;
}

/**
 * y-indexeddb persistence 연결. 브라우저 IndexedDB 에 Y.Doc 업데이트를 자동 저장.
 * 반환되는 Promise 는 초기 로드 완료 시 resolve.
 */
export async function persistDoc(projectId: string): Promise<void> {
  if (providerCache.has(projectId)) return;

  const doc = getProjectDoc(projectId);
  const provider = new IndexeddbPersistence(`balruno-ydoc-${projectId}`, doc);
  providerCache.set(projectId, provider);

  await provider.whenSynced;
}

/** 프로젝트 Y.Doc 에서 provider 분리 (메모리 해제). */
export function detachDoc(projectId: string): void {
  const provider = providerCache.get(projectId);
  if (provider) {
    provider.destroy();
    providerCache.delete(projectId);
  }
  const doc = docCache.get(projectId);
  if (doc) {
    doc.destroy();
    docCache.delete(projectId);
  }
}

// ============================================================================
// Y.Doc 내부 구조 헬퍼
// 구조:
//   doc.getMap('meta')       — 프로젝트 스칼라 (id, name, description, timestamps)
//   doc.getArray('sheets')   — Sheet Y.Map 목록
//   doc.getArray('folders')  — Folder Y.Map 목록
//
// Sheet Y.Map 구조:
//   { id, name, exportClassName?, folderId?, createdAt, updatedAt,
//     columns: Y.Array<Column Y.Map>,
//     rows: Y.Array<Row Y.Map>,
//     stickers: Y.Array<Sticker Y.Map> }
//
// Row Y.Map 구조:
//   { id, locked?, height?,
//     cells: Y.Map<columnId, CellValue>,
//     cellStyles: Y.Map<columnId, CellStyle>,
//     cellMemos: Y.Map<columnId, string> }
// ============================================================================

/** Project 객체 → Y.Doc 에 직렬화 (초기 로드 or 마이그레이션용). */
export function hydrateDocFromProject(doc: Y.Doc, project: Project): void {
  doc.transact(() => {
    const meta = doc.getMap('meta');
    meta.set('id', project.id);
    meta.set('name', project.name);
    meta.set('description', project.description ?? '');
    meta.set('createdAt', project.createdAt);
    meta.set('updatedAt', project.updatedAt);
    meta.set('syncMode', project.syncMode ?? 'local');
    if (project.syncRoomId) meta.set('syncRoomId', project.syncRoomId);

    const sheets = doc.getArray<Y.Map<unknown>>('sheets');
    sheets.delete(0, sheets.length); // 리셋
    for (const sheet of project.sheets) {
      sheets.push([sheetToYMap(sheet)]);
    }

    const folders = doc.getArray<Y.Map<unknown>>('folders');
    folders.delete(0, folders.length);
    for (const folder of project.folders ?? []) {
      folders.push([folderToYMap(folder)]);
    }
  });
}

/** Y.Doc → Project 객체 변환 (기존 Zustand/storage 하위호환용). */
export function docToProject(doc: Y.Doc): Project {
  const meta = doc.getMap('meta');
  const sheets = doc.getArray<Y.Map<unknown>>('sheets');
  const folders = doc.getArray<Y.Map<unknown>>('folders');

  return {
    id: meta.get('id') as string,
    name: meta.get('name') as string,
    description: (meta.get('description') as string) || undefined,
    createdAt: meta.get('createdAt') as number,
    updatedAt: meta.get('updatedAt') as number,
    syncMode: (meta.get('syncMode') as 'local' | 'cloud' | undefined) ?? 'local',
    syncRoomId: meta.get('syncRoomId') as string | undefined,
    sheets: sheets.toArray().map(yMapToSheet),
    folders: folders.length > 0 ? folders.toArray().map(yMapToFolder) : undefined,
  };
}

// ---- Sheet ----

function sheetToYMap(sheet: Sheet): Y.Map<unknown> {
  const map = new Y.Map();
  map.set('id', sheet.id);
  map.set('name', sheet.name);
  if (sheet.exportClassName) map.set('exportClassName', sheet.exportClassName);
  if (sheet.folderId) map.set('folderId', sheet.folderId);
  map.set('createdAt', sheet.createdAt);
  map.set('updatedAt', sheet.updatedAt);

  const columns = new Y.Array<Y.Map<unknown>>();
  for (const col of sheet.columns) columns.push([columnToYMap(col)]);
  map.set('columns', columns);

  const rows = new Y.Array<Y.Map<unknown>>();
  for (const row of sheet.rows) rows.push([rowToYMap(row)]);
  map.set('rows', rows);

  const stickers = new Y.Array<Y.Map<unknown>>();
  for (const sticker of sheet.stickers ?? []) stickers.push([stickerToYMap(sticker)]);
  map.set('stickers', stickers);

  return map;
}

function yMapToSheet(map: Y.Map<unknown>): Sheet {
  const columns = map.get('columns') as Y.Array<Y.Map<unknown>>;
  const rows = map.get('rows') as Y.Array<Y.Map<unknown>>;
  const stickers = map.get('stickers') as Y.Array<Y.Map<unknown>> | undefined;

  return {
    id: map.get('id') as string,
    name: map.get('name') as string,
    exportClassName: map.get('exportClassName') as string | undefined,
    folderId: map.get('folderId') as string | undefined,
    createdAt: map.get('createdAt') as number,
    updatedAt: map.get('updatedAt') as number,
    columns: columns.toArray().map(yMapToColumn),
    rows: rows.toArray().map(yMapToRow),
    stickers:
      stickers && stickers.length > 0 ? stickers.toArray().map(yMapToSticker) : undefined,
  };
}

// ---- Column ----

function columnToYMap(col: Column): Y.Map<unknown> {
  const map = new Y.Map();
  for (const [k, v] of Object.entries(col)) {
    if (v !== undefined) map.set(k, v);
  }
  return map;
}

function yMapToColumn(map: Y.Map<unknown>): Column {
  const out: Record<string, unknown> = {};
  map.forEach((v, k) => {
    out[k] = v;
  });
  return out as unknown as Column;
}

// ---- Row ----

function rowToYMap(row: Row): Y.Map<unknown> {
  const map = new Y.Map();
  map.set('id', row.id);
  if (row.locked) map.set('locked', row.locked);
  if (row.height !== undefined) map.set('height', row.height);

  const cells = new Y.Map<CellValue>();
  for (const [colId, value] of Object.entries(row.cells)) cells.set(colId, value);
  map.set('cells', cells);

  if (row.cellStyles) {
    const styles = new Y.Map<CellStyle>();
    for (const [colId, style] of Object.entries(row.cellStyles)) styles.set(colId, style);
    map.set('cellStyles', styles);
  }

  if (row.cellMemos) {
    const memos = new Y.Map<string>();
    for (const [colId, memo] of Object.entries(row.cellMemos)) memos.set(colId, memo);
    map.set('cellMemos', memos);
  }

  return map;
}

function yMapToRow(map: Y.Map<unknown>): Row {
  const cells = map.get('cells') as Y.Map<CellValue>;
  const styles = map.get('cellStyles') as Y.Map<CellStyle> | undefined;
  const memos = map.get('cellMemos') as Y.Map<string> | undefined;

  const row: Row = {
    id: map.get('id') as string,
    cells: {},
  };

  cells.forEach((value, colId) => {
    row.cells[colId] = value;
  });

  if (styles && styles.size > 0) {
    row.cellStyles = {};
    styles.forEach((style, colId) => {
      row.cellStyles![colId] = style;
    });
  }

  if (memos && memos.size > 0) {
    row.cellMemos = {};
    memos.forEach((memo, colId) => {
      row.cellMemos![colId] = memo;
    });
  }

  const locked = map.get('locked');
  if (locked) row.locked = locked as boolean;
  const height = map.get('height');
  if (height !== undefined) row.height = height as number;

  return row;
}

// ---- Sticker ----

function stickerToYMap(sticker: Sticker): Y.Map<unknown> {
  const map = new Y.Map();
  for (const [k, v] of Object.entries(sticker)) {
    if (v !== undefined) map.set(k, v);
  }
  return map;
}

function yMapToSticker(map: Y.Map<unknown>): Sticker {
  const out: Record<string, unknown> = {};
  map.forEach((v, k) => {
    out[k] = v;
  });
  return out as unknown as Sticker;
}

// ---- Folder ----

function folderToYMap(folder: Folder): Y.Map<unknown> {
  const map = new Y.Map();
  for (const [k, v] of Object.entries(folder)) {
    if (v !== undefined) map.set(k, v);
  }
  return map;
}

function yMapToFolder(map: Y.Map<unknown>): Folder {
  const out: Record<string, unknown> = {};
  map.forEach((v, k) => {
    out[k] = v;
  });
  return out as unknown as Folder;
}

// ============================================================================
// 편집 연산 (Zustand slice 에서 호출될 예정, 후속 커밋에서 통합)
// ============================================================================

/** 특정 시트의 특정 셀 값 업데이트. 양방향 관계/협업 동기화 기반. */
export function updateCellInDoc(
  doc: Y.Doc,
  sheetId: string,
  rowId: string,
  columnId: string,
  value: CellValue
): void {
  const sheets = doc.getArray<Y.Map<unknown>>('sheets');
  doc.transact(() => {
    for (const sheet of sheets) {
      if (sheet.get('id') !== sheetId) continue;
      const rows = sheet.get('rows') as Y.Array<Y.Map<unknown>>;
      for (const row of rows) {
        if (row.get('id') !== rowId) continue;
        const cells = row.get('cells') as Y.Map<CellValue>;
        cells.set(columnId, value);
        sheet.set('updatedAt', Date.now());
        return;
      }
    }
  });
}

/** 프로젝트 메타 정보 업데이트. */
export function updateProjectMeta(
  doc: Y.Doc,
  updates: Partial<Pick<Project, 'name' | 'description'>>
): void {
  const meta = doc.getMap('meta');
  doc.transact(() => {
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) meta.set(k, v);
    }
    meta.set('updatedAt', Date.now());
  });
}

/**
 * Y.Doc 이 hydrate 됐는지 (meta 에 id 가 쓰였는지) 판정.
 * y-indexeddb 로 이전 상태 복원 후 추가 hydrate 가 필요한지 판단하는 용도.
 */
export function isDocHydrated(doc: Y.Doc): boolean {
  return typeof doc.getMap('meta').get('id') === 'string';
}

/**
 * Y.Doc 변경을 구독. 로컬 write 든 원격 업데이트(y-indexeddb 복원, y-websocket 브로드캐스트)든
 * 모든 업데이트에 반응. transaction 경계로 묶이므로 배치 처리.
 *
 * 반환값 = 구독 해제 함수.
 */
export function observeProjectDoc(
  doc: Y.Doc,
  onChange: (project: Project) => void
): () => void {
  const handler = () => {
    if (!isDocHydrated(doc)) return;
    onChange(docToProject(doc));
  };
  doc.on('update', handler);
  return () => {
    doc.off('update', handler);
  };
}

/**
 * 프로젝트 초기화 파이프라인:
 *   1. Y.Doc 획득 (캐시)
 *   2. y-indexeddb persist → 이전 저장 상태 복원
 *   3. hydrate 전이면 Project 로부터 초기 상태 채움
 *   4. 최종 Y.Doc → Project 역직렬화 반환 (y-indexeddb 에 저장돼 있던 최신 상태)
 */
export async function initializeProjectDoc(project: Project): Promise<Project> {
  const doc = getProjectDoc(project.id);
  await persistDoc(project.id);

  if (!isDocHydrated(doc)) {
    hydrateDocFromProject(doc, project);
  }

  return docToProject(doc);
}

/**
 * Yjs Y.Doc 관리 — TrackYjs 마이그레이션의 핵심.
 *
 * 설계 원칙:
 * - 프로젝트당 1개의 Y.Doc
 * - y-indexeddb provider 가 자동 persistence (`balruno-ydoc-{projectId}` DB)
 * - 외부 인터페이스는 Project 타입 기반 (하위호환 유지)
 * - 후속 트랙에서 점진적으로 Y.Doc 을 직접 구독하도록 전환
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import type { Project, Sheet, Column, Row, CellValue, CellStyle, Sticker, Folder } from '@/types';

/** 프로젝트별 Y.Doc 캐시 (메모리 중복 방지) */
const docCache = new Map<string, Y.Doc>();
const providerCache = new Map<string, IndexeddbPersistence>();
const undoManagerCache = new Map<string, Y.UndoManager>();
const webrtcCache = new Map<string, WebrtcProvider>();

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
async function persistDoc(projectId: string): Promise<void> {
  if (providerCache.has(projectId)) return;

  const doc = getProjectDoc(projectId);
  const provider = new IndexeddbPersistence(`balruno-ydoc-${projectId}`, doc);
  providerCache.set(projectId, provider);

  await provider.whenSynced;
}

/** 프로젝트 Y.Doc 에서 provider 분리 (메모리 해제). */
export function detachDoc(projectId: string): void {
  detachWebrtc(projectId);
  const um = undoManagerCache.get(projectId);
  if (um) {
    um.destroy();
    undoManagerCache.delete(projectId);
  }
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

/**
 * TrackStage B — y-webrtc P2P 협업 연결.
 * room 은 URL hash 에서 공유되는 비밀키 (공용 신호서버 사용 시에도 데이터는 E2E).
 * 같은 room 에 연결한 브라우저끼리 Y.Doc 자동 sync.
 */
export function attachWebrtc(projectId: string, roomName: string): WebrtcProvider {
  const existing = webrtcCache.get(projectId);
  if (existing) return existing;

  const doc = getProjectDoc(projectId);
  const provider = new WebrtcProvider(roomName, doc, {
    // Yjs 공식 운영. heroku 신호서버는 2022 free tier 폐지로 동작하지 않아 제거.
    // 필요 시 자체 호스트로 교체 (y-webrtc-signaling docker image 또는 Spring Boot).
    signaling: ['wss://signaling.yjs.dev'],
  });
  webrtcCache.set(projectId, provider);
  return provider;
}

export function detachWebrtc(projectId: string): void {
  const provider = webrtcCache.get(projectId);
  if (provider) {
    provider.destroy();
    webrtcCache.delete(projectId);
  }
}

/** 활성 WebRTC provider 반환 (awareness 접근용). */
export function getWebrtc(projectId: string): WebrtcProvider | undefined {
  return webrtcCache.get(projectId);
}

/**
 * 프로젝트별 Y.UndoManager. sheets/folders Y.Array 와 meta Y.Map 을 추적.
 * captureTimeout 500ms 이내 편집은 한 undo 스텝으로 병합.
 * stack-item-added 시 `timestamp` 를 meta 에 기록 (HistoryPanel 표시용).
 */
export function getUndoManager(projectId: string): Y.UndoManager {
  let um = undoManagerCache.get(projectId);
  if (!um) {
    const doc = getProjectDoc(projectId);
    um = new Y.UndoManager(
      [doc.getArray('sheets'), doc.getArray('folders'), doc.getMap('meta')],
      { captureTimeout: 500 }
    );
    um.on('stack-item-added', ({ stackItem }) => {
      stackItem.meta.set('timestamp', Date.now());
    });
    undoManagerCache.set(projectId, um);
  }
  return um;
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
/**
 * 메모리 Sheet 배열에서 같은 ID 중복 제거 — updatedAt 가장 큰 인스턴스 우선.
 * docToProject 의 마지막 방어선. yjs Y.Array 손상이 메모리로 새지 않게 한다.
 */
function dedupeSheetsByLatest(sheets: Sheet[]): Sheet[] {
  const winner = new Map<string, Sheet>();
  for (const s of sheets) {
    const cur = winner.get(s.id);
    if (!cur || (s.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
      winner.set(s.id, s);
    }
  }
  // 원래 순서 보존을 위해 sheets 순회하되 winner 만 한 번씩 yield
  const emitted = new Set<string>();
  const result: Sheet[] = [];
  for (const s of sheets) {
    if (emitted.has(s.id)) continue;
    const w = winner.get(s.id);
    if (w) {
      result.push(w);
      emitted.add(s.id);
    }
  }
  return result;
}

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

    const docs = doc.getArray<Y.Map<unknown>>('docs');
    docs.delete(0, docs.length);
    for (const d of project.docs ?? []) {
      docs.push([docToYMap(d)]);
    }
  });
}

/** Y.Doc → Project 객체 변환 (기존 Zustand/storage 하위호환용). */
export function docToProject(doc: Y.Doc): Project {
  const meta = doc.getMap('meta');
  const sheets = doc.getArray<Y.Map<unknown>>('sheets');
  const folders = doc.getArray<Y.Map<unknown>>('folders');
  const docs = doc.getArray<Y.Map<unknown>>('docs');
  const changelog = doc.getArray<Y.Map<unknown>>('changelog');

  return {
    id: meta.get('id') as string,
    name: meta.get('name') as string,
    description: (meta.get('description') as string) || undefined,
    createdAt: meta.get('createdAt') as number,
    updatedAt: meta.get('updatedAt') as number,
    syncMode: (meta.get('syncMode') as 'local' | 'cloud' | undefined) ?? 'local',
    syncRoomId: meta.get('syncRoomId') as string | undefined,
    // 메모리 dedupe — yjs Y.Array 에 같은 sheet ID 가 여러 번 박혀있어도 (yjs sync race
    // / 이전 버전 버그로 누적된 IndexedDB 손상) 메모리 상으로는 한 번만 노출.
    // updatedAt 가장 큰 인스턴스 우선 — dedupeSheetsInDoc 와 동일 정책.
    // 이건 마지막 방어선이고, 진짜 정리는 dedupeSheetsInDoc 가 yjs Y.Array 에서 수행.
    sheets: dedupeSheetsByLatest(sheets.toArray().map(yMapToSheet)),
    folders: folders.length > 0 ? folders.toArray().map(yMapToFolder) : undefined,
    docs: docs.length > 0 ? docs.toArray().map(yMapToDoc) : undefined,
    changelog: changelog.length > 0 ? changelog.toArray().map((m) => m.toJSON() as ChangeEntry) : undefined,
  };
}

// ---- Sheet ----

function sheetToYMap(sheet: Sheet): Y.Map<unknown> {
  const map = new Y.Map();
  map.set('id', sheet.id);
  map.set('name', sheet.name);
  if (sheet.icon) map.set('icon', sheet.icon);
  if (sheet.kind) map.set('kind', sheet.kind);
  if (sheet.exportClassName) map.set('exportClassName', sheet.exportClassName);
  if (sheet.folderId) map.set('folderId', sheet.folderId);
  // 다중 라벨 — JSON string 으로 저장 (yjs Y.Map 의 array 값 persist 일관성 확보)
  if (sheet.tags && sheet.tags.length > 0) map.set('tags', JSON.stringify(sheet.tags));
  // 뷰 스위처 상태
  if (sheet.activeView) map.set('activeView', sheet.activeView);
  if (sheet.viewGroupColumnId) map.set('viewGroupColumnId', sheet.viewGroupColumnId);
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
    icon: map.get('icon') as string | undefined,
    kind: map.get('kind') as Sheet['kind'] | undefined,
    exportClassName: map.get('exportClassName') as string | undefined,
    folderId: map.get('folderId') as string | undefined,
    tags: (() => {
      const raw = map.get('tags');
      // 신규 포맷 (JSON string) 우선, 구포맷 (JS array) 도 fallback 처리
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? (parsed as string[]) : undefined;
        } catch {
          return undefined;
        }
      }
      if (Array.isArray(raw)) return (raw as string[]).slice();
      return undefined;
    })(),
    activeView: map.get('activeView') as Sheet['activeView'] | undefined,
    viewGroupColumnId: map.get('viewGroupColumnId') as string | undefined,
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
  // 초기 hydrate 시 y-indexeddb 가 수십~수백 개 update 이벤트를 연속 발행.
  // 매번 docToProject(O(sheets × rows × cols)) + setState 를 호출하면
  // 브라우저 메인 스레드가 수 초간 block. 50ms rAF-align 디바운스로 묶어
  // 한 번만 재구성. 이후에도 cell 편집 burst 시 중간 스냅샷 스킵.
  let scheduled = false;
  let rafHandle: number | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    scheduled = false;
    rafHandle = null;
    timeoutHandle = null;
    if (!isDocHydrated(doc)) return;
    onChange(docToProject(doc));
  };

  const handler = () => {
    if (!isDocHydrated(doc)) return;
    if (scheduled) return;
    scheduled = true;
    // 50ms 내 연속 update 는 하나로 병합. SSR/테스트 환경도 고려.
    if (typeof requestAnimationFrame !== 'undefined') {
      timeoutHandle = setTimeout(() => {
        rafHandle = requestAnimationFrame(flush);
      }, 50);
    } else {
      timeoutHandle = setTimeout(flush, 50);
    }
  };

  doc.on('update', handler);
  return () => {
    doc.off('update', handler);
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    if (rafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafHandle);
    }
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

// ============================================================================
// Phase 2 편집 연산 — 모든 slice write 액션이 이 helper 로 수렴.
// 각 함수는 doc.transact 로 원자적 업데이트 보장.
// observer 는 transact 종료 시 1회 fire.
// ============================================================================

/** 특정 시트의 Y.Map 과 인덱스를 반환 (내부 헬퍼 — cellComments 등 외부에서도 사용). */
export function findSheetMap(
  doc: Y.Doc,
  sheetId: string
): { sheet: Y.Map<unknown>; index: number } | null {
  const sheets = doc.getArray<Y.Map<unknown>>('sheets');
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets.get(i);
    if (sheet.get('id') === sheetId) return { sheet, index: i };
  }
  return null;
}

/** 시트 내 Row Y.Map 과 인덱스 반환. */
function findRowMap(
  sheet: Y.Map<unknown>,
  rowId: string
): { row: Y.Map<unknown>; index: number } | null {
  const rows = sheet.get('rows') as Y.Array<Y.Map<unknown>>;
  for (let i = 0; i < rows.length; i++) {
    const row = rows.get(i);
    if (row.get('id') === rowId) return { row, index: i };
  }
  return null;
}

/** 시트 내 Column Y.Map 과 인덱스 반환. */
function findColumnMap(
  sheet: Y.Map<unknown>,
  columnId: string
): { column: Y.Map<unknown>; index: number } | null {
  const columns = sheet.get('columns') as Y.Array<Y.Map<unknown>>;
  for (let i = 0; i < columns.length; i++) {
    const column = columns.get(i);
    if (column.get('id') === columnId) return { column, index: i };
  }
  return null;
}

/** 폴더 Y.Array 내 인덱스 반환. */
function findFolderMap(
  doc: Y.Doc,
  folderId: string
): { folder: Y.Map<unknown>; index: number } | null {
  const folders = doc.getArray<Y.Map<unknown>>('folders');
  for (let i = 0; i < folders.length; i++) {
    const folder = folders.get(i);
    if (folder.get('id') === folderId) return { folder, index: i };
  }
  return null;
}

export function touchSheet(sheet: Y.Map<unknown>): void {
  sheet.set('updatedAt', Date.now());
}

// ---- Sheet 레벨 ----

export function addSheetInDoc(doc: Y.Doc, sheet: Sheet): void {
  doc.transact(() => {
    const sheets = doc.getArray<Y.Map<unknown>>('sheets');
    // 같은 ID 가 이미 존재하면 거부 — 데이터 손상 방지 가드.
    // 손상 발생 시 콘솔 stack trace 로 호출 경로 추적 가능.
    for (let i = 0; i < sheets.length; i++) {
      const existingId = sheets.get(i).get('id');
      if (existingId === sheet.id) {
        // eslint-disable-next-line no-console
        console.error(
          `[addSheetInDoc] 중복 sheet ID 추가 거부: ${sheet.id} (${sheet.name}). 호출 경로 확인:`,
          new Error('duplicate sheet add').stack,
        );
        return;
      }
    }
    sheets.push([sheetToYMap(sheet)]);
  });
}

export function updateSheetInDoc(
  doc: Y.Doc,
  sheetId: string,
  updates: Partial<Pick<Sheet,
    | 'name'
    | 'icon'
    | 'kind'
    | 'exportClassName'
    | 'folderId'
    | 'activeView'
    | 'viewGroupColumnId'
    | 'viewKanbanCoverColumnId'
    | 'viewKanbanFieldIds'
    | 'viewCalendarEndColumnId'
    | 'viewGanttEndColumnId'
    | 'viewGanttDependsColumnId'
    | 'savedViews'
    | 'activeSavedViewId'
    | 'tags'
  >>
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) {
        found.sheet.delete(k);
      } else if (k === 'tags' && Array.isArray(v)) {
        // 다중 라벨 — JSON string 으로 저장 (Y.Map array 값 persist 일관성)
        found.sheet.set(k, JSON.stringify(v));
      } else {
        found.sheet.set(k, v);
      }
    }
    touchSheet(found.sheet);
  });
}

export function deleteSheetInDoc(doc: Y.Doc, sheetId: string): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    doc.getArray<Y.Map<unknown>>('sheets').delete(found.index, 1);
  });
}

export function duplicateSheetInDoc(doc: Y.Doc, newSheet: Sheet, atIndex?: number): void {
  doc.transact(() => {
    const sheets = doc.getArray<Y.Map<unknown>>('sheets');
    // 중복 ID 가드 (addSheetInDoc 와 동일 정책)
    for (let i = 0; i < sheets.length; i++) {
      if (sheets.get(i).get('id') === newSheet.id) {
        // eslint-disable-next-line no-console
        console.error(
          `[duplicateSheetInDoc] 중복 sheet ID 추가 거부: ${newSheet.id} (${newSheet.name}). 호출 경로 확인:`,
          new Error('duplicate sheet duplicate').stack,
        );
        return;
      }
    }
    const ymap = sheetToYMap(newSheet);
    if (atIndex !== undefined && atIndex <= sheets.length) {
      sheets.insert(atIndex, [ymap]);
    } else {
      sheets.push([ymap]);
    }
  });
}

/**
 * 데이터 손상 복구용: 같은 sheet ID 가 sheets Y.Array 에 여러 번 들어간 경우
 * updatedAt 가 가장 큰 (가장 최근) 인스턴스만 남기고 나머지를 삭제.
 * yjs 동기화 race / 이전 버전 버그로 누적된 IndexedDB 데이터를 정리한다.
 *
 * 반환값: 제거한 중복 시트 수.
 */
export function dedupeSheetsInDoc(doc: Y.Doc): number {
  let removed = 0;
  doc.transact(() => {
    const sheets = doc.getArray<Y.Map<unknown>>('sheets');
    // 1단계: ID 별로 가장 최신 인덱스 찾기
    const winner = new Map<string, { index: number; updatedAt: number }>();
    for (let i = 0; i < sheets.length; i++) {
      const id = sheets.get(i).get('id') as string | undefined;
      if (typeof id !== 'string') continue;
      const u = (sheets.get(i).get('updatedAt') as number | undefined) ?? 0;
      const cur = winner.get(id);
      if (!cur || u > cur.updatedAt) {
        winner.set(id, { index: i, updatedAt: u });
      }
    }
    // 2단계: winner 가 아닌 인덱스 수집 후 뒤에서부터 삭제
    const keepIndices = new Set(Array.from(winner.values()).map((w) => w.index));
    for (let i = sheets.length - 1; i >= 0; i--) {
      if (!keepIndices.has(i)) {
        sheets.delete(i, 1);
        removed++;
      }
    }
  });
  return removed;
}

export function reorderSheetsInDoc(doc: Y.Doc, fromIndex: number, toIndex: number): void {
  doc.transact(() => {
    const sheets = doc.getArray<Y.Map<unknown>>('sheets');
    if (fromIndex < 0 || fromIndex >= sheets.length) return;
    const snapshot = sheets.get(fromIndex).toJSON();
    // Y.Array 는 move 가 없어 재구성이 필요 — 전체 시트를 JSON 으로 복사 후 재생성.
    // 동시 편집 시 행/컬럼 변경이 덮일 수 있으니 reorder 는 되도록 idle 에서만 호출.
    sheets.delete(fromIndex, 1);
    const rebuilt = rebuildSheetYMapFromJSON(snapshot);
    const clamped = Math.max(0, Math.min(toIndex, sheets.length));
    sheets.insert(clamped, [rebuilt]);
  });
}

// ---- Column 레벨 ----

export function addColumnInDoc(
  doc: Y.Doc,
  sheetId: string,
  column: Column
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const columns = found.sheet.get('columns') as Y.Array<Y.Map<unknown>>;
    columns.push([columnToYMap(column)]);
    touchSheet(found.sheet);
  });
}

export function insertColumnInDoc(
  doc: Y.Doc,
  sheetId: string,
  column: Column,
  atIndex: number
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const columns = found.sheet.get('columns') as Y.Array<Y.Map<unknown>>;
    const clamped = Math.max(0, Math.min(atIndex, columns.length));
    columns.insert(clamped, [columnToYMap(column)]);
    touchSheet(found.sheet);
  });
}

export function updateColumnInDoc(
  doc: Y.Doc,
  sheetId: string,
  columnId: string,
  updates: Partial<Column>
): void {
  doc.transact(() => {
    const sheetFound = findSheetMap(doc, sheetId);
    if (!sheetFound) return;
    const colFound = findColumnMap(sheetFound.sheet, columnId);
    if (!colFound) return;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) {
        colFound.column.delete(k);
      } else {
        colFound.column.set(k, v);
      }
    }
    touchSheet(sheetFound.sheet);
  });
}

export function deleteColumnInDoc(
  doc: Y.Doc,
  sheetId: string,
  columnId: string
): void {
  doc.transact(() => {
    const sheetFound = findSheetMap(doc, sheetId);
    if (!sheetFound) return;
    const colFound = findColumnMap(sheetFound.sheet, columnId);
    if (!colFound) return;

    (sheetFound.sheet.get('columns') as Y.Array<Y.Map<unknown>>).delete(colFound.index, 1);

    // 각 row.cells 에서 columnId 제거 (관련 스타일/메모도)
    const rows = sheetFound.sheet.get('rows') as Y.Array<Y.Map<unknown>>;
    for (let i = 0; i < rows.length; i++) {
      const row = rows.get(i);
      (row.get('cells') as Y.Map<CellValue>).delete(columnId);
      const styles = row.get('cellStyles') as Y.Map<CellStyle> | undefined;
      if (styles) styles.delete(columnId);
      const memos = row.get('cellMemos') as Y.Map<string> | undefined;
      if (memos) memos.delete(columnId);
    }
    touchSheet(sheetFound.sheet);
  });
}

export function reorderColumnsInDoc(
  doc: Y.Doc,
  sheetId: string,
  columnIds: string[]
): void {
  doc.transact(() => {
    const sheetFound = findSheetMap(doc, sheetId);
    if (!sheetFound) return;
    const columns = sheetFound.sheet.get('columns') as Y.Array<Y.Map<unknown>>;

    const jsonByCol = new Map<string, unknown>();
    for (let i = 0; i < columns.length; i++) {
      const col = columns.get(i);
      jsonByCol.set(col.get('id') as string, col.toJSON());
    }

    columns.delete(0, columns.length);
    for (const id of columnIds) {
      const json = jsonByCol.get(id);
      if (json) columns.push([rebuildColumnYMapFromJSON(json)]);
    }
    touchSheet(sheetFound.sheet);
  });
}

// ---- Row 레벨 ----

export function addRowInDoc(doc: Y.Doc, sheetId: string, row: Row): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    (found.sheet.get('rows') as Y.Array<Y.Map<unknown>>).push([rowToYMap(row)]);
    touchSheet(found.sheet);
  });
}

export function insertRowInDoc(
  doc: Y.Doc,
  sheetId: string,
  row: Row,
  atIndex: number
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const rows = found.sheet.get('rows') as Y.Array<Y.Map<unknown>>;
    const clamped = Math.max(0, Math.min(atIndex, rows.length));
    rows.insert(clamped, [rowToYMap(row)]);
    touchSheet(found.sheet);
  });
}

/**
 * 단일 row 를 새 위치(targetIndex) 로 이동.
 * Kanban 같은 컬럼 내 정렬 + cross-column 이동에서 사용.
 * Y.Array 는 in-place 이동 API 가 없어 delete + insert 패턴.
 * cellStyles/cellMemos 같은 Y.Map 자식은 rebuildRowYMapFromJSON 으로 재구성.
 */
export function reorderRowInDoc(
  doc: Y.Doc,
  sheetId: string,
  rowId: string,
  targetIndex: number
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const rows = found.sheet.get('rows') as Y.Array<Y.Map<unknown>>;

    let fromIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows.get(i).get('id') === rowId) {
        fromIdx = i;
        break;
      }
    }
    if (fromIdx < 0) return;

    const json = rows.get(fromIdx).toJSON();
    rows.delete(fromIdx, 1);
    // 삭제 후 인덱스 보정 — 원래 인덱스보다 뒤로 가는 경우 -1
    const adjusted = targetIndex > fromIdx ? targetIndex - 1 : targetIndex;
    const clamped = Math.max(0, Math.min(adjusted, rows.length));
    rows.insert(clamped, [rebuildRowYMapFromJSON(json)]);
    touchSheet(found.sheet);
  });
}

export function updateRowInDoc(
  doc: Y.Doc,
  sheetId: string,
  rowId: string,
  updates: Partial<Row>
): void {
  doc.transact(() => {
    const sheetFound = findSheetMap(doc, sheetId);
    if (!sheetFound) return;
    const rowFound = findRowMap(sheetFound.sheet, rowId);
    if (!rowFound) return;

    for (const [k, v] of Object.entries(updates)) {
      // cells/cellStyles/cellMemos 는 Y.Map 이라 replace 대신 key merge
      if (k === 'cells' && v && typeof v === 'object') {
        const target = rowFound.row.get('cells') as Y.Map<CellValue>;
        for (const [colId, value] of Object.entries(v as Record<string, CellValue>)) {
          target.set(colId, value);
        }
        continue;
      }
      if (k === 'cellStyles' && v && typeof v === 'object') {
        let target = rowFound.row.get('cellStyles') as Y.Map<CellStyle> | undefined;
        if (!target) {
          target = new Y.Map<CellStyle>();
          rowFound.row.set('cellStyles', target);
        }
        for (const [colId, style] of Object.entries(v as Record<string, CellStyle>)) {
          target.set(colId, style);
        }
        continue;
      }
      if (k === 'cellMemos' && v && typeof v === 'object') {
        let target = rowFound.row.get('cellMemos') as Y.Map<string> | undefined;
        if (!target) {
          target = new Y.Map<string>();
          rowFound.row.set('cellMemos', target);
        }
        for (const [colId, memo] of Object.entries(v as Record<string, string>)) {
          target.set(colId, memo);
        }
        continue;
      }
      if (v === undefined) {
        rowFound.row.delete(k);
      } else {
        rowFound.row.set(k, v);
      }
    }
    touchSheet(sheetFound.sheet);
  });
}

export function deleteRowInDoc(doc: Y.Doc, sheetId: string, rowId: string): void {
  doc.transact(() => {
    const sheetFound = findSheetMap(doc, sheetId);
    if (!sheetFound) return;
    const rowFound = findRowMap(sheetFound.sheet, rowId);
    if (!rowFound) return;
    (sheetFound.sheet.get('rows') as Y.Array<Y.Map<unknown>>).delete(rowFound.index, 1);
    touchSheet(sheetFound.sheet);
  });
}

export function addMultipleRowsInDoc(
  doc: Y.Doc,
  sheetId: string,
  rows: Row[]
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const rowsArr = found.sheet.get('rows') as Y.Array<Y.Map<unknown>>;
    const mapped = rows.map((r) => rowToYMap(r));
    rowsArr.push(mapped);
    touchSheet(found.sheet);
  });
}

// ---- Cell 스타일 ----

export function updateCellStyleInDoc(
  doc: Y.Doc,
  sheetId: string,
  rowId: string,
  columnId: string,
  style: CellStyle
): void {
  doc.transact(() => {
    const sheetFound = findSheetMap(doc, sheetId);
    if (!sheetFound) return;
    const rowFound = findRowMap(sheetFound.sheet, rowId);
    if (!rowFound) return;
    let styles = rowFound.row.get('cellStyles') as Y.Map<CellStyle> | undefined;
    if (!styles) {
      styles = new Y.Map<CellStyle>();
      rowFound.row.set('cellStyles', styles);
    }
    styles.set(columnId, style);
    touchSheet(sheetFound.sheet);
  });
}

export function updateCellsStyleInDoc(
  doc: Y.Doc,
  sheetId: string,
  targets: Array<{ rowId: string; columnId: string; style: CellStyle }>
): void {
  doc.transact(() => {
    const sheetFound = findSheetMap(doc, sheetId);
    if (!sheetFound) return;
    for (const { rowId, columnId, style } of targets) {
      const rowFound = findRowMap(sheetFound.sheet, rowId);
      if (!rowFound) continue;
      let styles = rowFound.row.get('cellStyles') as Y.Map<CellStyle> | undefined;
      if (!styles) {
        styles = new Y.Map<CellStyle>();
        rowFound.row.set('cellStyles', styles);
      }
      styles.set(columnId, style);
    }
    touchSheet(sheetFound.sheet);
  });
}
// ---- Sticker ----

export function addStickerInDoc(doc: Y.Doc, sheetId: string, sticker: Sticker): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    let stickers = found.sheet.get('stickers') as Y.Array<Y.Map<unknown>> | undefined;
    if (!stickers) {
      stickers = new Y.Array<Y.Map<unknown>>();
      found.sheet.set('stickers', stickers);
    }
    stickers.push([stickerToYMap(sticker)]);
    touchSheet(found.sheet);
  });
}

export function updateStickerInDoc(
  doc: Y.Doc,
  sheetId: string,
  stickerId: string,
  updates: Partial<Sticker>
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const stickers = found.sheet.get('stickers') as Y.Array<Y.Map<unknown>> | undefined;
    if (!stickers) return;
    for (let i = 0; i < stickers.length; i++) {
      const st = stickers.get(i);
      if (st.get('id') !== stickerId) continue;
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined) st.delete(k);
        else st.set(k, v);
      }
      touchSheet(found.sheet);
      return;
    }
  });
}

export function deleteStickerInDoc(doc: Y.Doc, sheetId: string, stickerId: string): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const stickers = found.sheet.get('stickers') as Y.Array<Y.Map<unknown>> | undefined;
    if (!stickers) return;
    for (let i = 0; i < stickers.length; i++) {
      if ((stickers.get(i).get('id') as string) === stickerId) {
        stickers.delete(i, 1);
        touchSheet(found.sheet);
        return;
      }
    }
  });
}

// ---- Folder ----

export function addFolderInDoc(doc: Y.Doc, folder: Folder): void {
  doc.transact(() => {
    const folders = doc.getArray<Y.Map<unknown>>('folders');
    folders.push([folderToYMap(folder)]);
  });
}

export function updateFolderInDoc(
  doc: Y.Doc,
  folderId: string,
  updates: Partial<Folder>
): void {
  doc.transact(() => {
    const found = findFolderMap(doc, folderId);
    if (!found) return;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) found.folder.delete(k);
      else found.folder.set(k, v);
    }
  });
}

/**
 * 폴더 삭제. deleteContents = true 면 폴더 내 시트도 함께 삭제,
 * false 면 시트의 folderId 만 제거 (루트로 이동).
 * 하위 폴더는 재귀적으로 함께 처리.
 */
export function deleteFolderInDoc(
  doc: Y.Doc,
  folderId: string,
  deleteContents: boolean
): void {
  doc.transact(() => {
    const folders = doc.getArray<Y.Map<unknown>>('folders');
    const sheets = doc.getArray<Y.Map<unknown>>('sheets');

    const toDelete = new Set<string>();
    const collect = (id: string) => {
      toDelete.add(id);
      for (let i = 0; i < folders.length; i++) {
        const f = folders.get(i);
        if ((f.get('parentId') as string | undefined) === id) {
          collect(f.get('id') as string);
        }
      }
    };
    collect(folderId);

    // 시트 처리
    for (let i = sheets.length - 1; i >= 0; i--) {
      const sheet = sheets.get(i);
      const fid = sheet.get('folderId') as string | undefined;
      if (!fid || !toDelete.has(fid)) continue;
      if (deleteContents) {
        sheets.delete(i, 1);
      } else {
        sheet.delete('folderId');
        touchSheet(sheet);
      }
    }

    // 폴더 삭제 (높은 인덱스부터)
    for (let i = folders.length - 1; i >= 0; i--) {
      const f = folders.get(i);
      if (toDelete.has(f.get('id') as string)) {
        folders.delete(i, 1);
      }
    }
  });
}

export function toggleFolderExpandedInDoc(doc: Y.Doc, folderId: string): void {
  doc.transact(() => {
    const found = findFolderMap(doc, folderId);
    if (!found) return;
    const current = (found.folder.get('isExpanded') as boolean | undefined) ?? true;
    found.folder.set('isExpanded', !current);
    found.folder.set('updatedAt', Date.now());
  });
}

export function moveSheetToFolderInDoc(
  doc: Y.Doc,
  sheetId: string,
  folderId: string | null
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    if (folderId) found.sheet.set('folderId', folderId);
    else found.sheet.delete('folderId');
    touchSheet(found.sheet);
  });
}

export function moveFolderToFolderInDoc(
  doc: Y.Doc,
  folderId: string,
  parentId: string | null
): void {
  doc.transact(() => {
    const found = findFolderMap(doc, folderId);
    if (!found) return;

    // 순환 참조 방지: parentId 가 folderId 의 자손이면 이동 금지
    if (parentId) {
      const isDescendant = (checkId: string | undefined, ancestorId: string): boolean => {
        if (!checkId) return false;
        if (checkId === ancestorId) return true;
        const parent = findFolderMap(doc, checkId);
        return parent
          ? isDescendant(parent.folder.get('parentId') as string | undefined, ancestorId)
          : false;
      };
      if (isDescendant(parentId, folderId)) return;
      found.folder.set('parentId', parentId);
    } else {
      found.folder.delete('parentId');
    }
    found.folder.set('updatedAt', Date.now());
  });
}

export function reorderFoldersInDoc(
  doc: Y.Doc,
  parentId: string | null,
  fromIndex: number,
  toIndex: number
): void {
  doc.transact(() => {
    const folders = doc.getArray<Y.Map<unknown>>('folders');
    // 같은 parentId 를 가진 폴더만 대상
    const sameLevelIndices: number[] = [];
    for (let i = 0; i < folders.length; i++) {
      const f = folders.get(i);
      const fp = (f.get('parentId') as string | undefined) ?? null;
      if (fp === parentId) sameLevelIndices.push(i);
    }
    if (fromIndex < 0 || fromIndex >= sameLevelIndices.length) return;
    const srcIdx = sameLevelIndices[fromIndex];
    const snapshot = folders.get(srcIdx).toJSON();
    folders.delete(srcIdx, 1);

    // toIndex 재계산 — 삭제 후 같은 레벨의 인덱스 재수집
    const recomputed: number[] = [];
    for (let i = 0; i < folders.length; i++) {
      const f = folders.get(i);
      const fp = (f.get('parentId') as string | undefined) ?? null;
      if (fp === parentId) recomputed.push(i);
    }
    const clamped = Math.max(0, Math.min(toIndex, recomputed.length));
    const insertAt = clamped < recomputed.length ? recomputed[clamped] : folders.length;
    folders.insert(insertAt, [rebuildFolderYMapFromJSON(snapshot)]);
  });
}

// ---- 내부: JSON 스냅샷 → Y.Map 재생성 (reorder 전용) ----

function rebuildSheetYMapFromJSON(json: unknown): Y.Map<unknown> {
  const obj = json as Record<string, unknown>;
  const map = new Y.Map();
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'columns' && Array.isArray(v)) {
      const arr = new Y.Array<Y.Map<unknown>>();
      for (const c of v) arr.push([rebuildColumnYMapFromJSON(c)]);
      map.set('columns', arr);
    } else if (k === 'rows' && Array.isArray(v)) {
      const arr = new Y.Array<Y.Map<unknown>>();
      for (const r of v) arr.push([rebuildRowYMapFromJSON(r)]);
      map.set('rows', arr);
    } else if (k === 'stickers' && Array.isArray(v)) {
      const arr = new Y.Array<Y.Map<unknown>>();
      for (const s of v) arr.push([rebuildGenericYMap(s as Record<string, unknown>)]);
      map.set('stickers', arr);
    } else {
      map.set(k, v);
    }
  }
  return map;
}

function rebuildColumnYMapFromJSON(json: unknown): Y.Map<unknown> {
  return rebuildGenericYMap(json as Record<string, unknown>);
}

function rebuildRowYMapFromJSON(json: unknown): Y.Map<unknown> {
  const obj = json as Record<string, unknown>;
  const map = new Y.Map();
  for (const [k, v] of Object.entries(obj)) {
    if ((k === 'cells' || k === 'cellStyles' || k === 'cellMemos') && v && typeof v === 'object') {
      const ymap = new Y.Map();
      for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) {
        ymap.set(kk, vv);
      }
      map.set(k, ymap);
    } else {
      map.set(k, v);
    }
  }
  return map;
}

function rebuildFolderYMapFromJSON(json: unknown): Y.Map<unknown> {
  return rebuildGenericYMap(json as Record<string, unknown>);
}

function rebuildGenericYMap(obj: Record<string, unknown>): Y.Map<unknown> {
  const map = new Y.Map();
  for (const [k, v] of Object.entries(obj)) {
    map.set(k, v);
  }
  return map;
}

// ============================================================================
// Changelog — Track내부 기록. UI 는 아직 미완이지만 cellSlice 가 매 cell
// 업데이트 시 append 하므로 여기서 최소 구현을 제공.
// ============================================================================

import type { ChangeEntry, Doc } from '@/types';

// ---- Doc (GDD · 설계안) ----

function docToYMap(d: Doc): Y.Map<unknown> {
  const map = new Y.Map();
  map.set('id', d.id);
  map.set('name', d.name);
  if (d.icon) map.set('icon', d.icon);
  map.set('content', d.content);
  if (d.parentId) map.set('parentId', d.parentId);
  if (d.isExpanded !== undefined) map.set('isExpanded', d.isExpanded);
  if (d.position !== undefined) map.set('position', d.position);
  map.set('createdAt', d.createdAt);
  map.set('updatedAt', d.updatedAt);
  return map;
}

function yMapToDoc(map: Y.Map<unknown>): Doc {
  return {
    id: map.get('id') as string,
    name: map.get('name') as string,
    icon: map.get('icon') as string | undefined,
    content: (map.get('content') as string) ?? '',
    parentId: map.get('parentId') as string | undefined,
    isExpanded: map.get('isExpanded') as boolean | undefined,
    position: map.get('position') as number | undefined,
    createdAt: map.get('createdAt') as number,
    updatedAt: map.get('updatedAt') as number,
  };
}

export function addDocInDoc(doc: Y.Doc, newDoc: Doc): void {
  doc.transact(() => {
    const docs = doc.getArray<Y.Map<unknown>>('docs');
    docs.push([docToYMap(newDoc)]);
  });
}

export function updateDocInDoc(
  doc: Y.Doc,
  docId: string,
  updates: Partial<Pick<Doc, 'name' | 'content' | 'icon' | 'parentId' | 'isExpanded' | 'position'>>
): void {
  doc.transact(() => {
    const docs = doc.getArray<Y.Map<unknown>>('docs');
    for (let i = 0; i < docs.length; i++) {
      const d = docs.get(i);
      if (d.get('id') === docId) {
        for (const [k, v] of Object.entries(updates)) {
          if (v === undefined) d.delete(k);
          else d.set(k, v);
        }
        d.set('updatedAt', Date.now());
        return;
      }
    }
  });
}

export function deleteDocInDoc(doc: Y.Doc, docId: string): void {
  doc.transact(() => {
    const docs = doc.getArray<Y.Map<unknown>>('docs');
    for (let i = 0; i < docs.length; i++) {
      if (docs.get(i).get('id') === docId) {
        docs.delete(i, 1);
        return;
      }
    }
  });
}

export function appendChangelogInDoc(doc: Y.Doc, entry: ChangeEntry): void {
  doc.transact(() => {
    const log = doc.getArray<Y.Map<unknown>>('changelog');
    const map = new Y.Map();
    for (const [k, v] of Object.entries(entry)) {
      map.set(k, v);
    }
    log.push([map]);
    // 메모리 관리: 최근 500개만 유지
    const MAX = 500;
    if (log.length > MAX) {
      log.delete(0, log.length - MAX);
    }
  });
}

export function updateChangelogReason(doc: Y.Doc, entryId: string, reason: string): void {
  doc.transact(() => {
    const log = doc.getArray<Y.Map<unknown>>('changelog');
    for (let i = 0; i < log.length; i++) {
      const entry = log.get(i);
      if (entry.get('id') === entryId) {
        entry.set('reason', reason);
        return;
      }
    }
  });
}

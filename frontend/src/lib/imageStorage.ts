/**
 * 이미지/파일 blob 로컬 저장 — IndexedDB 기반.
 *
 * 동기: Gallery 뷰 · attachment 컬럼에서 이미지 업로드 경험 제공.
 * 백엔드 없이도 로컬 드래그-드롭 업로드가 작동하도록.
 *
 * 저장 형식:
 *   - 컬럼/셀 값은 `indb:<blobId>` 문자열 참조
 *   - 실제 Blob 은 IndexedDB 'balruno-blobs' DB 의 'blobs' store
 *   - 렌더 시 URL.createObjectURL(blob) 로 ObjectURL 생성
 *
 * 백엔드 마이그레이션:
 *   - `indb:<id>` 참조를 서버 업로드 결과 URL 로 교체만 하면 됨
 *   - resolveImageSrc() 가 유일한 호출 지점이라 swap 간단
 */

import { openDB, type IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'balruno-blobs';
const DB_VERSION = 1;
const STORE = 'blobs';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** Blob 저장 → `indb:<id>` 참조 반환 */
export async function storeBlob(blob: Blob): Promise<string> {
  const db = await getDb();
  const id = uuidv4();
  await db.put(STORE, blob, id);
  return `indb:${id}`;
}

/** 참조에서 Blob 로드 */
export async function loadBlob(ref: string): Promise<Blob | null> {
  if (!ref.startsWith('indb:')) return null;
  const id = ref.slice(5);
  const db = await getDb();
  const blob = (await db.get(STORE, id)) as Blob | undefined;
  return blob ?? null;
}

/** Blob 삭제 */
export async function deleteBlob(ref: string): Promise<void> {
  if (!ref.startsWith('indb:')) return;
  const id = ref.slice(5);
  const db = await getDb();
  await db.delete(STORE, id);
}

/**
 * 이미지 src 리졸버 — 입력이 다양한 형태를 모두 처리:
 *  - `indb:<id>` → ObjectURL 반환 (비동기)
 *  - `data:...` / `http(s):` → 그대로 반환
 *  - 기타 → null
 *
 * 호출자는 반환된 URL 사용 후 cleanup (URL.revokeObjectURL) 필요 —
 * useImageSrc 훅으로 wrap 해서 자동 처리 권장.
 */
export async function resolveImageSrc(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('indb:')) {
    const blob = await loadBlob(value);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return null;
}

/** 확장자 기반 이미지 판정 + indb / data 접두 모두 포함 */
export function isImageReference(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.startsWith('indb:')) return true;
  if (value.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(value);
}

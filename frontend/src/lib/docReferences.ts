/**
 * 문서 @참조 — backlink 조회 헬퍼.
 *
 * 원래 @sheet/@task/@doc 형태의 inline reference 를 파싱하는 parseReferences 가
 * 있었으나 실제 사용처가 없어 제거됨 (yjs Y.Map mention 노드로 대체된 듯).
 * 현재는 docId 단순 substring 매칭 backlink 조회만 사용 중.
 */

import type { Doc, Sheet } from '@/types';

/** 문서 backlink 수집 — 특정 docId 를 참조하는 다른 문서 찾기 */
export function findBacklinks(targetDocId: string, docs: Doc[]): Doc[] {
  const needle = `@doc:${targetDocId}`;
  return docs.filter((d) => d.id !== targetDocId && d.content.includes(needle));
}

export type { Sheet };

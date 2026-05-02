/**
 * Doc ↔ 시트 row backlink 인덱스.
 *
 * Tiptap mention 노드 형태 (data-id="task:{sheetId}:{rowId}") 를 정규식으로 스캔해
 * { sheetId, rowId } → docIds[] 매핑 생성.
 *
 * 사용처: RecordEditor (행 상세 패널) 의 "이 row 를 참조하는 문서" 섹션.
 *
 * 한계:
 *  - HTML 직렬화된 content 의 data-id 속성에 의존 — Tiptap 의 createMentionExtension 이
 *    이 형식으로 직렬화함을 가정.
 *  - 매번 전체 docs.content 를 파싱 — 큰 프로젝트에선 useMemo 캐시 권장.
 */

import type { Project } from '@/types';

export type RowKey = string; // `${sheetId}:${rowId}`

/** Doc content (HTML 직렬화) 에서 모든 mention id 를 추출. (private — buildRowBacklinks 만 사용) */
function extractMentionIds(content: string): string[] {
  if (!content) return [];
  const ids: string[] = [];
  for (const m of content.matchAll(/data-id="([^"]+)"/g)) {
    if (m[1]) ids.push(m[1]);
  }
  return ids;
}

/**
 * 프로젝트의 모든 doc 을 스캔해 row 별 backlink 인덱스 빌드.
 * key = `${sheetId}:${rowId}`, value = doc id 배열 (중복 제거).
 */
export function buildRowBacklinks(project: Project): Map<RowKey, string[]> {
  const map = new Map<RowKey, string[]>();
  for (const doc of project.docs ?? []) {
    const ids = extractMentionIds(doc.content ?? '');
    const seen = new Set<string>();
    for (const mid of ids) {
      if (!mid.startsWith('task:')) continue;
      const parts = mid.split(':');
      if (parts.length < 3) continue;
      const sheetId = parts[1];
      const rowId = parts.slice(2).join(':');
      if (!sheetId || !rowId) continue;
      const key = `${sheetId}:${rowId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const list = map.get(key) ?? [];
      list.push(doc.id);
      map.set(key, list);
    }
  }
  return map;
}


/**
 * 셀 코멘트 / @멘션 시스템 — Track 8 협업 마무리.
 *
 * 저장 위치: sheet.get('comments') = Y.Array<Y.Map>
 * 한 코멘트는 cell 단위로 attach 되며 thread (parentId) 로 연결.
 * 멘션은 텍스트 중 @name 토큰을 client 가 파싱.
 *
 * 기존 cellMemos (단일 텍스트) 와 별개. 메모는 빠른 1줄 노트, 코멘트는 토론 스레드.
 */

import * as Y from 'yjs';
import { findSheetMap, touchSheet } from './ydoc';

export interface CellComment {
  id: string;
  rowId: string;
  columnId: string;
  author: string;
  authorColor: string;
  text: string;
  /** 텍스트에서 추출한 @멘션 사용자 이름 (중복 제거) */
  mentions: string[];
  timestamp: number;
  /** 답글이면 부모 코멘트 id */
  parentId?: string;
  resolved?: boolean;
}

function commentToYMap(c: CellComment): Y.Map<unknown> {
  const map = new Y.Map();
  map.set('id', c.id);
  map.set('rowId', c.rowId);
  map.set('columnId', c.columnId);
  map.set('author', c.author);
  map.set('authorColor', c.authorColor);
  map.set('text', c.text);
  map.set('mentions', c.mentions);
  map.set('timestamp', c.timestamp);
  if (c.parentId) map.set('parentId', c.parentId);
  if (c.resolved) map.set('resolved', c.resolved);
  return map;
}

function yMapToComment(map: Y.Map<unknown>): CellComment {
  return {
    id: map.get('id') as string,
    rowId: map.get('rowId') as string,
    columnId: map.get('columnId') as string,
    author: map.get('author') as string,
    authorColor: (map.get('authorColor') as string) ?? '#94a3b8',
    text: map.get('text') as string,
    mentions: (map.get('mentions') as string[]) ?? [],
    timestamp: map.get('timestamp') as number,
    parentId: map.get('parentId') as string | undefined,
    resolved: (map.get('resolved') as boolean) ?? false,
  };
}

/** 텍스트에서 @멘션 추출. @ 다음 영문/숫자/하이픈/언더스코어 연속. */
export function parseMentions(text: string): string[] {
  const matches = text.matchAll(/@([A-Za-z0-9_-]{2,32})/g);
  const set = new Set<string>();
  for (const m of matches) set.add(m[1]);
  return Array.from(set);
}

export function addComment(
  doc: Y.Doc,
  sheetId: string,
  partial: Omit<CellComment, 'id' | 'timestamp' | 'mentions'> & { id?: string; timestamp?: number },
): CellComment {
  const full: CellComment = {
    id: partial.id ?? `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    rowId: partial.rowId,
    columnId: partial.columnId,
    author: partial.author,
    authorColor: partial.authorColor,
    text: partial.text,
    mentions: parseMentions(partial.text),
    timestamp: partial.timestamp ?? Date.now(),
    parentId: partial.parentId,
    resolved: partial.resolved,
  };
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    let comments = found.sheet.get('comments') as Y.Array<Y.Map<unknown>> | undefined;
    if (!comments) {
      comments = new Y.Array<Y.Map<unknown>>();
      found.sheet.set('comments', comments);
    }
    comments.push([commentToYMap(full)]);
    touchSheet(found.sheet);
  });
  return full;
}

export function updateComment(
  doc: Y.Doc,
  sheetId: string,
  commentId: string,
  patch: Partial<Pick<CellComment, 'text' | 'resolved'>>,
): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const comments = found.sheet.get('comments') as Y.Array<Y.Map<unknown>> | undefined;
    if (!comments) return;
    for (let i = 0; i < comments.length; i++) {
      const c = comments.get(i);
      if (c.get('id') === commentId) {
        if (patch.text !== undefined) {
          c.set('text', patch.text);
          c.set('mentions', parseMentions(patch.text));
        }
        if (patch.resolved !== undefined) c.set('resolved', patch.resolved);
        touchSheet(found.sheet);
        return;
      }
    }
  });
}

export function deleteComment(doc: Y.Doc, sheetId: string, commentId: string): void {
  doc.transact(() => {
    const found = findSheetMap(doc, sheetId);
    if (!found) return;
    const comments = found.sheet.get('comments') as Y.Array<Y.Map<unknown>> | undefined;
    if (!comments) return;
    for (let i = 0; i < comments.length; i++) {
      if (comments.get(i).get('id') === commentId) {
        comments.delete(i, 1);
        touchSheet(found.sheet);
        return;
      }
    }
  });
}

export function getCommentsForSheet(doc: Y.Doc, sheetId: string): CellComment[] {
  const found = findSheetMap(doc, sheetId);
  if (!found) return [];
  const comments = found.sheet.get('comments') as Y.Array<Y.Map<unknown>> | undefined;
  if (!comments) return [];
  return comments.toArray().map(yMapToComment);
}

/** 시트의 comments Y.Array 자체를 노출 (observer 구독용). */
export function getCommentsArray(doc: Y.Doc, sheetId: string): Y.Array<Y.Map<unknown>> | null {
  const found = findSheetMap(doc, sheetId);
  if (!found) return null;
  const comments = found.sheet.get('comments') as Y.Array<Y.Map<unknown>> | undefined;
  if (comments) return comments;
  let created: Y.Array<Y.Map<unknown>> | null = null;
  doc.transact(() => {
    const arr = new Y.Array<Y.Map<unknown>>();
    found.sheet.set('comments', arr);
    created = arr;
  });
  return created;
}

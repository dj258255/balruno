/**
 * Comment types — Figma-style threads attached to cells, rows, sheets, or docs.
 *
 * Stored under the project's Y.Doc as `comments: Y.Array<Y.Map>`. Each entry
 * matches {@link CommentThread}. Replies are children of a thread, kept inline
 * for query simplicity (sheet 100명 미만이면 inline 충분).
 */

export type CommentTarget =
  | { kind: 'cell'; sheetId: string; rowId: string; columnId: string }
  | { kind: 'row'; sheetId: string; rowId: string }
  | { kind: 'sheet'; sheetId: string }
  | { kind: 'doc'; docId: string };

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: number;
  editedAt?: number;
}

export interface CommentThread {
  id: string;
  target: CommentTarget;
  resolved: boolean;
  createdAt: number;
  comments: Comment[];
}

export function targetKey(t: CommentTarget): string {
  switch (t.kind) {
    case 'cell':
      return `cell:${t.sheetId}:${t.rowId}:${t.columnId}`;
    case 'row':
      return `row:${t.sheetId}:${t.rowId}`;
    case 'sheet':
      return `sheet:${t.sheetId}`;
    case 'doc':
      return `doc:${t.docId}`;
  }
}

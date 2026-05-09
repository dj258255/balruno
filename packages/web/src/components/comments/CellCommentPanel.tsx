'use client';

/**
 * Side panel that lists + adds comments for a single sheet cell
 * (ADR 0024 Stage E). Opened by clicking the cell context menu's
 * "Show comments" or the inline badge in SheetTable.
 *
 * MVP scope:
 *   - Plain textarea body (Tiptap rich-text + @mentions land in
 *     the doc-body Stage F). The textarea content is wrapped into
 *     a Tiptap-shape JSON document so the backend's bodyJson
 *     handling stays uniform.
 *   - List ordered by createdAt (oldest first).
 *   - Resolve toggle per comment.
 *   - Author can edit / delete their own comments.
 *
 * Real-time peer broadcast (Stage C) is not wired yet — the panel
 * re-fetches on open + after every local mutation.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X, Check, Trash2, MessageSquareReply } from 'lucide-react';
import type { JSONContent } from '@tiptap/react';
import { toast } from 'sonner';

import {
  type BackendComment,
  createComment,
  deleteComment,
  listCommentsForCell,
  setCommentResolved,
} from '@/lib/backend';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { CommentBody } from './CommentBody';
import MentionEditor, { type MentionEditorHandle } from './MentionEditor';

interface CellCommentPanelProps {
  projectId: string;
  sheetId: string;
  rowId: string;
  columnId: string;
  /** Cell label shown in the panel header (e.g. "Row 3 · HP"). */
  cellLabel: string;
  onClose: () => void;
}

export function CellCommentPanel({
  projectId,
  sheetId,
  rowId,
  columnId,
  cellLabel,
  onClose,
}: CellCommentPanelProps) {
  const [comments, setComments] = useState<BackendComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftJson, setDraftJson] = useState<JSONContent | null>(null);
  const [posting, setPosting] = useState(false);
  const editorRef = useRef<MentionEditorHandle | null>(null);
  const workspaceId = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId)?.workspaceId,
  );
  // Reply target — when set, the bottom textarea posts as a reply to
  // this thread. Click "Reply" on a root comment to populate; clear
  // by sending or canceling. ADR 0024 v2.1 stage H.
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const me = useAuthStore((s) => s.user);

  // Group comments into root + reply trees. Server returns flat list
  // ordered by createdAt; we organise client-side so the panel can
  // render the threaded display without an extra round-trip per
  // root.
  const threads = useMemo(() => {
    if (!comments) return null;
    const roots = comments.filter((c) => !c.parentId);
    const repliesByParent = new Map<string, BackendComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = repliesByParent.get(c.parentId) ?? [];
        arr.push(c);
        repliesByParent.set(c.parentId, arr);
      }
    }
    return roots.map((root) => ({
      root,
      replies: repliesByParent.get(root.id) ?? [],
    }));
  }, [comments]);

  // Initial fetch + re-fetch on peer broadcast. The wss bridge
  // dispatches 'balruno:comment-event' on every comment.added /
  // comment.updated / comment.deleted that arrives. We refetch
  // wholesale instead of patching in-place — the event volume is
  // low and the simpler shape avoids race against the local
  // mutation path. (ADR 0024 Stage C.)
  useEffect(() => {
    let cancelled = false;
    const refetch = async () => {
      try {
        const list = await listCommentsForCell({ projectId, sheetId, rowId, columnId });
        if (!cancelled) setComments(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '코멘트 로드 실패');
      }
    };
    void refetch();
    const onPeer = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId: string }>).detail;
      if (detail?.projectId !== projectId) return;
      void refetch();
    };
    window.addEventListener('balruno:comment-event', onPeer);
    return () => {
      cancelled = true;
      window.removeEventListener('balruno:comment-event', onPeer);
    };
  }, [projectId, sheetId, rowId, columnId]);

  const handlePost = async () => {
    if (posting) return;
    const body = draftJson ?? editorRef.current?.getJson();
    if (!body || isEmptyDoc(body)) return;
    setPosting(true);
    try {
      const created = await createComment({
        projectId,
        scopeKind: 'SHEET_CELL',
        sheetId,
        rowId,
        columnId,
        // Reply if replyToId is set (Stage H), otherwise root comment.
        parentId: replyToId ?? undefined,
        // MentionEditor (Stage F) emits the real Tiptap doc shape with
        // mention nodes inlined; backend MentionExtractor walks for
        // {type:'mention', attrs:{id}} to record mention rows.
        bodyJson: body,
      });
      setComments((prev) => (prev ? [...prev, created] : [created]));
      editorRef.current?.clear();
      setDraftJson(null);
      setReplyToId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '코멘트 작성 실패');
    } finally {
      setPosting(false);
    }
  };

  const handleResolve = async (c: BackendComment) => {
    try {
      const updated = await setCommentResolved(c.id, !c.resolved);
      setComments((prev) =>
        prev ? prev.map((x) => (x.id === c.id ? updated : x)) : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '상태 변경 실패');
    }
  };

  const handleDelete = async (c: BackendComment) => {
    if (!window.confirm('이 코멘트를 삭제할까요?')) return;
    try {
      await deleteComment(c.id);
      setComments((prev) => (prev ? prev.filter((x) => x.id !== c.id) : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  return (
    <aside
      className="flex h-full w-80 flex-col border-l"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
    >
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            코멘트
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {cellLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {comments === null && !error && (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            로딩 중...
          </div>
        )}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
        {threads && threads.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            아직 코멘트가 없습니다.
          </p>
        )}
        {threads && threads.length > 0 && (
          <ul className="space-y-3">
            {threads.map(({ root, replies }) => (
              <li key={root.id} className="space-y-2">
                <CommentItem
                  c={root}
                  isMe={me?.id === root.authorUserId}
                  onResolve={handleResolve}
                  onDelete={handleDelete}
                  onReply={() => setReplyToId(root.id)}
                  isReplying={replyToId === root.id}
                />
                {replies.length > 0 && (
                  <ul className="ml-4 space-y-2 border-l-2 pl-3" style={{ borderColor: 'var(--border-primary)' }}>
                    {replies.map((r) => (
                      <li key={r.id}>
                        <CommentItem
                          c={r}
                          isMe={me?.id === r.authorUserId}
                          onResolve={handleResolve}
                          onDelete={handleDelete}
                          // Replies don't recurse — Slack / Linear pattern,
                          // one nesting level only.
                          onReply={null}
                          isReplying={false}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer
        className="border-t p-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {replyToId && (
          <div
            className="mb-2 flex items-center justify-between rounded px-2 py-1 text-xs"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            <span>답글 작성 중</span>
            <button
              type="button"
              onClick={() => setReplyToId(null)}
              className="rounded p-0.5 hover:bg-[var(--bg-hover)]"
              aria-label="답글 취소"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <MentionEditor
          ref={editorRef}
          workspaceId={workspaceId}
          placeholder={replyToId ? '답글... (@ 으로 멤버 멘션)' : '이 셀에 대한 의견... (@ 으로 멤버 멘션)'}
          disabled={posting}
          onChange={setDraftJson}
          onSubmit={handlePost}
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || isEmptyDoc(draftJson)}
          className="mt-2 w-full rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {posting ? '전송 중...' : replyToId ? '답글 추가' : '코멘트 추가'}
        </button>
      </footer>
    </aside>
  );
}

interface CommentItemProps {
  c: BackendComment;
  isMe: boolean;
  onResolve: (c: BackendComment) => void;
  onDelete: (c: BackendComment) => void;
  onReply: (() => void) | null;
  isReplying: boolean;
}

function CommentItem({ c, isMe, onResolve, onDelete, onReply, isReplying }: CommentItemProps) {
  return (
    <div
      className="rounded-md border p-3"
      style={{
        borderColor: isReplying ? 'var(--accent)' : 'var(--border-primary)',
        background: c.resolved ? 'var(--bg-secondary)' : 'transparent',
        opacity: c.resolved ? 0.6 : 1,
      }}
    >
      <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <span className="font-mono">{c.authorUserId.slice(0, 8)}</span>
        <span>{new Date(c.createdAt).toLocaleString()}</span>
      </div>
      <CommentBody
        body={c.bodyJson}
        className="text-sm"
        style={{ color: 'var(--text-primary)' }}
        fallback={<span style={{ color: 'var(--text-tertiary)' }}>(내용 없음)</span>}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onResolve(c)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <Check className="h-3 w-3" />
          {c.resolved ? '해결됨' : '해결'}
        </button>
        {onReply && (
          <button
            type="button"
            onClick={onReply}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <MessageSquareReply className="h-3 w-3" />
            답글
          </button>
        )}
        {isMe && (
          <button
            type="button"
            onClick={() => onDelete(c)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Trash2 className="h-3 w-3" />
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Plain-text projection of a Tiptap doc that keeps mention nodes
 * visible as `@label`. Walking once is fine — bodies are bounded to
 * the comment shape (no lists, no code blocks).
 */
function extractPlainText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const collected: string[] = [];
  walk(body, collected);
  return collected.join(' ').trim();
}

function walk(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as { type?: string; text?: unknown; attrs?: { label?: unknown; id?: unknown }; content?: unknown };
  if (obj.type === 'text' && typeof obj.text === 'string') {
    out.push(obj.text);
  } else if (obj.type === 'mention') {
    const label = typeof obj.attrs?.label === 'string'
      ? obj.attrs.label
      : typeof obj.attrs?.id === 'string'
        ? obj.attrs.id
        : '';
    if (label) out.push(`@${label}`);
  }
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) walk(child, out);
  }
}

/** Empty-doc detector — Tiptap's empty state is `doc > paragraph` with no text. */
function isEmptyDoc(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true;
  return extractPlainText(body).length === 0;
}

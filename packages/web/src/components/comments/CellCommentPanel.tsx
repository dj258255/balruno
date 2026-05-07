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

import { useEffect, useState } from 'react';
import { Loader2, X, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  type BackendComment,
  createComment,
  deleteComment,
  listCommentsForCell,
  setCommentResolved,
} from '@/lib/backend';
import { useAuthStore } from '@/stores/authStore';

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
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const me = useAuthStore((s) => s.user);

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
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const created = await createComment({
        projectId,
        scopeKind: 'SHEET_CELL',
        sheetId,
        rowId,
        columnId,
        // Wrap plain text into the minimum Tiptap doc shape so the
        // backend stores a future-proof JSON body. Rich-text Stage F
        // produces the real Tiptap output here.
        bodyJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
        },
      });
      setComments((prev) => (prev ? [...prev, created] : [created]));
      setDraft('');
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
        {comments && comments.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            아직 코멘트가 없습니다.
          </p>
        )}
        {comments && comments.length > 0 && (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-md border p-3"
                style={{
                  borderColor: 'var(--border-primary)',
                  background: c.resolved ? 'var(--bg-secondary)' : 'transparent',
                  opacity: c.resolved ? 0.6 : 1,
                }}
              >
                <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="font-mono">{c.authorUserId.slice(0, 8)}</span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {extractPlainText(c.bodyJson)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolve(c)}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Check className="h-3 w-3" />
                    {c.resolved ? '해결됨' : '해결'}
                  </button>
                  {me?.id === c.authorUserId && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer
        className="border-t p-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="이 셀에 대한 의견..."
          rows={3}
          disabled={posting}
          className="w-full rounded-md border px-2 py-1.5 text-sm disabled:opacity-50"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={!draft.trim() || posting}
          className="mt-2 w-full rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {posting ? '전송 중...' : '코멘트 추가'}
        </button>
      </footer>
    </aside>
  );
}

/**
 * Extract the plain text from a Tiptap JSON doc — the MVP textarea
 * stores `paragraph > text` only, so a single concat works. Rich-
 * text Stage F replaces this with a proper Tiptap render.
 */
function extractPlainText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const collected: string[] = [];
  walk(body, collected);
  return collected.join(' ').trim();
}

function walk(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as { type?: string; text?: unknown; content?: unknown };
  if (obj.type === 'text' && typeof obj.text === 'string') {
    out.push(obj.text);
  }
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) walk(child, out);
  }
}

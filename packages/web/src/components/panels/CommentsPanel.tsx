'use client';

/**
 * CommentsPanel — project-wide comment + @mention browse for the
 * BottomDock share group. Newest-first list, scope filter, click-to-
 * jump dispatched as a custom event so SheetTable / DocView can
 * select the target without this panel knowing the layout.
 *
 * Scope split with the other comment surfaces:
 *  - CellCommentPanel  (sheet cell context menu) — single cell thread
 *  - InboxBell         (header)                  — my unread mentions, global
 *  - CommentsPanel     (this)                    — project browse + filter
 *
 * Filters are client-side because the project list is server-capped
 * at 200 rows: walking bodyJson once per row is cheap and saves a
 * second query.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, RefreshCw } from 'lucide-react';

import {
  type BackendComment,
  listCommentsForProject,
} from '@/lib/backend';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';

interface CommentsPanelProps {
  onClose?: () => void;
  isPanel?: boolean;
}

type FilterMode = 'all' | 'mentions' | 'unresolved';

export default function CommentsPanel({ onClose }: CommentsPanelProps) {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const me = useAuthStore((s) => s.user);

  const [comments, setComments] = useState<BackendComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<FilterMode>('all');

  useEffect(() => {
    if (!projectId) {
      setComments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listCommentsForProject(projectId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '코멘트 로드 실패');
          setComments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Re-fetch on peer broadcast so the dock panel stays live with
    // CellCommentPanel writes. The bridge already dispatches this on
    // every comment.added / updated / deleted (ADR 0024 Stage C).
    const onPeer = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId: string }>).detail;
      if (detail?.projectId !== projectId) return;
      setReloadKey((k) => k + 1);
    };
    window.addEventListener('balruno:comment-event', onPeer);
    return () => {
      cancelled = true;
      window.removeEventListener('balruno:comment-event', onPeer);
    };
  }, [projectId, reloadKey]);

  const filtered = useMemo(() => {
    if (!comments) return null;
    switch (mode) {
      case 'mentions':
        if (!me?.id) return [];
        return comments.filter((c) => bodyMentionsUser(c.bodyJson, me.id));
      case 'unresolved':
        return comments.filter((c) => !c.resolved);
      default:
        return comments;
    }
  }, [comments, mode, me?.id]);

  const handleJump = (c: BackendComment) => {
    if (c.scopeKind === 'SHEET_CELL' && c.sheetId && c.rowId && c.columnId) {
      window.dispatchEvent(
        new CustomEvent('balruno:comment-jump', {
          detail: {
            kind: 'cell',
            projectId: c.projectId,
            sheetId: c.sheetId,
            rowId: c.rowId,
            columnId: c.columnId,
            commentId: c.id,
          },
        }),
      );
    } else if (c.scopeKind === 'DOC_BODY' && c.documentId) {
      window.dispatchEvent(
        new CustomEvent('balruno:comment-jump', {
          detail: {
            kind: 'doc',
            projectId: c.projectId,
            documentId: c.documentId,
            commentId: c.id,
          },
        }),
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <MessageSquare className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          코멘트 / 멘션
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="rounded p-1 hover:bg-[var(--bg-hover)] disabled:opacity-50"
          style={{ color: 'var(--text-tertiary)' }}
          disabled={loading}
          aria-label="새로고침"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: 'var(--border-primary)' }}>
        <FilterTab active={mode === 'all'} label="전체" count={comments?.length ?? null} onClick={() => setMode('all')} />
        <FilterTab
          active={mode === 'mentions'}
          label="내 멘션"
          count={comments && me?.id ? comments.filter((c) => bodyMentionsUser(c.bodyJson, me.id)).length : null}
          onClick={() => setMode('mentions')}
        />
        <FilterTab
          active={mode === 'unresolved'}
          label="미해결"
          count={comments ? comments.filter((c) => !c.resolved).length : null}
          onClick={() => setMode('unresolved')}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!projectId && (
          <p className="px-2 py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            프로젝트를 먼저 선택하세요.
          </p>
        )}
        {projectId && loading && comments === null && (
          <div
            className="flex items-center justify-center gap-2 p-6 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            로딩 중...
          </div>
        )}
        {error && (
          <p className="m-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
        {projectId && filtered && filtered.length === 0 && !loading && !error && (
          <p className="px-2 py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {mode === 'mentions'
              ? '받은 멘션이 없습니다.'
              : mode === 'unresolved'
                ? '미해결 코멘트가 없습니다.'
                : '코멘트가 아직 없습니다.'}
          </p>
        )}
        {filtered && filtered.length > 0 && (
          <ul className="space-y-1.5">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleJump(c)}
                  className="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: 'var(--border-primary)',
                    background: c.resolved ? 'var(--bg-secondary)' : 'transparent',
                    opacity: c.resolved ? 0.65 : 1,
                  }}
                >
                  <div
                    className="mb-1 flex items-center justify-between gap-2 text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <ScopeBadge kind={c.scopeKind} />
                      <span className="font-mono">{c.authorUserId.slice(0, 8)}</span>
                      {c.parentId && <span className="rounded bg-[var(--bg-secondary)] px-1">답글</span>}
                      {c.resolved && <span className="rounded bg-green-100 px-1 text-green-700 dark:bg-green-950/40 dark:text-green-300">해결됨</span>}
                    </span>
                    <span>{relativeTime(c.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                    {extractPlainText(c.bodyJson) || <span style={{ color: 'var(--text-tertiary)' }}>(내용 없음)</span>}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {onClose && (
        <div className="border-t p-2" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}

interface FilterTabProps {
  active: boolean;
  label: string;
  count: number | null;
  onClick: () => void;
}

function FilterTab({ active, label, count, onClick }: FilterTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
      style={{
        background: active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
      {count !== null && (
        <span
          className="rounded-full px-1.5 text-[10px]"
          style={{
            background: active ? 'var(--accent)' : 'var(--bg-secondary)',
            color: active ? 'white' : 'var(--text-tertiary)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ScopeBadge({ kind }: { kind: BackendComment['scopeKind'] }) {
  const label = kind === 'SHEET_CELL' ? '셀' : '문서';
  return (
    <span
      className="rounded px-1 text-[10px] font-medium"
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
    >
      {label}
    </span>
  );
}

/**
 * Recursively check if a Tiptap doc body contains a mention node
 * targeting userId. Mention extension serialises as
 * `{type: "mention", attrs: {id: "<uuid>"}}` (same shape backend
 * MentionExtractor parses).
 */
function bodyMentionsUser(body: unknown, userId: string): boolean {
  if (!body || typeof body !== 'object') return false;
  const obj = body as { type?: string; attrs?: { id?: unknown }; content?: unknown };
  if (obj.type === 'mention' && obj.attrs?.id === userId) return true;
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) {
      if (bodyMentionsUser(child, userId)) return true;
    }
  }
  return false;
}

function extractPlainText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const out: string[] = [];
  walkText(body, out);
  return out.join(' ').trim();
}

function walkText(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as { type?: string; text?: unknown; content?: unknown };
  if (obj.type === 'text' && typeof obj.text === 'string') out.push(obj.text);
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) walkText(child, out);
  }
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return '방금';
  if (diff < hr) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hr)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return new Date(iso).toLocaleDateString();
}

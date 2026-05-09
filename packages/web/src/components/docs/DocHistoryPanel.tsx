'use client';

/**
 * DocHistoryPanel — page history for a single doc body (ADR 0038
 * stage C frontend).
 *
 * Side drawer pattern (Notion / Outline / AFFiNE). Shows a newest-
 * first list of snapshot moments; clicking a row pulls the yjs state
 * bytes for that snapshot, applies them to a fresh Y.Doc, and shows
 * the resulting plain text in a read-only preview pane on the right.
 *
 * 'Restore this version' is intentionally deferred — yjs CRDTs are
 * append-only so a true restore needs to compute the inverse of every
 * update since the snapshot, which is non-trivial. v1 is preview only;
 * the user copies text out manually if they want to revert. Same path
 * Notion took for years before it shipped a proper restore.
 *
 * Mounted via a portal to document.body to escape any sidebar /
 * header transform-containing-block.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Y from 'yjs';
import { History, Loader2, X } from 'lucide-react';

import {
  downloadDocSnapshotState,
  fetchDocSnapshots,
  type DocSnapshot,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

interface Props {
  docId: string;
  docTitle: string;
  onClose: () => void;
}

export default function DocHistoryPanel({ docId, docTitle, onClose }: Props) {
  const myUserId = useBackendAuthStore((s) => s.user?.id);
  const [snapshots, setSnapshots] = useState<DocSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchDocSnapshots(docId, { limit: 50 })
      .then((rows) => {
        if (cancelled) return;
        setSnapshots(rows);
        if (rows.length > 0) setActiveId(rows[0].id);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load history');
        setSnapshots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (!activeId) {
      setPreviewText(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void downloadDocSnapshotState(docId, activeId)
      .then((buf) => {
        if (cancelled) return;
        try {
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, new Uint8Array(buf));
          // Walk the same xml fragments the collab snapshot extractor
          // uses. The first non-empty one wins. Falls through to a
          // 'no preview' line on shape mismatches.
          const fragments = ['default', 'doc', 'content'];
          let plain = '';
          for (const name of fragments) {
            const xml = ydoc.getXmlFragment(name);
            const raw = xml.toString();
            if (raw && raw.length > 0) {
              plain = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              if (plain.length > 0) break;
            }
          }
          setPreviewText(plain || '(빈 문서)');
        } catch (e) {
          setPreviewText(`(미리보기 실패 — ${e instanceof Error ? e.message : 'unknown'})`);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setPreviewText(`(스냅샷 로드 실패 — ${e instanceof Error ? e.message : 'unknown'})`);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docId, activeId]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl border shadow-xl"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left list */}
        <aside
          className="flex w-72 flex-col border-r"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              <History className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              변경 이력
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 hover:bg-[var(--bg-hover)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex h-full items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ) : error ? (
              <p className="px-2 py-3 text-xs" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            ) : !snapshots || snapshots.length === 0 ? (
              <p className="px-2 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                아직 저장된 스냅샷이 없습니다. 본문을 입력하면 자동으로 시간 별 스냅샷이 쌓여요.
              </p>
            ) : (
              <ul className="space-y-1">
                {snapshots.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(s.id)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                      style={{
                        background: s.id === activeId ? 'var(--bg-tertiary)' : 'transparent',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">
                          {actorLabel(s.actorUserId, myUserId)}
                        </span>
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          {formatRelative(s.createdAt)}
                        </span>
                      </div>
                      {s.summary && (
                        <p
                          className="mt-0.5 line-clamp-2"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {s.summary}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right preview */}
        <section className="flex flex-1 flex-col">
          <header
            className="border-b px-6 py-3"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {docTitle}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              읽기 전용 미리보기 — 복원하려면 본문을 복사해서 사용하세요
            </p>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {previewLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ) : previewText === null ? (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                왼쪽에서 시점을 선택하세요.
              </p>
            ) : (
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}
              >
                {previewText}
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function actorLabel(actorId: string | null, myUserId: string | undefined): string {
  if (!actorId) return '시스템';
  if (myUserId && actorId === myUserId) return '나';
  return `User ${actorId.slice(0, 6)}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString();
}

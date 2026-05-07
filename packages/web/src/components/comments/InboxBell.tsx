'use client';

/**
 * Header bell that surfaces the user's unread @mention inbox
 * (ADR 0024 Stage G MVP). Clicking the bell toggles a popover that
 * lists the most recent unread mentions; each row deep-links into
 * the comment's project (the cell- or doc-level routing happens
 * inside the project page itself once selection lands).
 *
 * MVP scope deliberately small:
 *   - No "mark read" action yet — backend Mention.read_at is set
 *     when the user opens the *comment thread*, not when they
 *     glance at the inbox. (Stage H tracks this.)
 *   - Polls once per visible-tab cycle + on every comment-event
 *     broadcast. Real-time push without polling = cheap addition
 *     once the wss bridge gains a 'comment.mention' fan-out.
 */

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

import { listInbox, type BackendComment } from '@/lib/backend';

const POLL_MS = 60_000;

export function InboxBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BackendComment[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refetch = async () => {
      try {
        const list = await listInbox(20);
        if (!cancelled) setItems(list);
      } catch {
        // Inbox is best-effort; failures stay silent in the header.
      }
    };
    void refetch();
    const interval = window.setInterval(refetch, POLL_MS);
    const onPeer = () => void refetch();
    window.addEventListener('balruno:comment-event', onPeer);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('balruno:comment-event', onPeer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Click-outside to dismiss the popover. We listen on mousedown so
  // the close fires before the synthetic React click on a target
  // inside the popover (avoids closing when the user clicks a row).
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const unread = items.length;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded hover:bg-[var(--bg-hover)] max-md:h-11 max-md:w-11"
        style={{ color: 'var(--text-secondary)' }}
        aria-label={`받은 멘션 ${unread}개`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border shadow-lg"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-primary)',
          }}
        >
          <div
            className="border-b px-3 py-2 text-xs font-medium"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-tertiary)',
            }}
          >
            받은 멘션
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              읽지 않은 멘션이 없습니다.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="border-b px-3 py-2 last:border-b-0"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <div
                    className="mb-1 flex items-center justify-between text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span className="font-mono">{c.authorUserId.slice(0, 8)}</span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p
                    className="line-clamp-2 text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {extractPlainText(c.bodyJson)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function extractPlainText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const out: string[] = [];
  walk(body, out);
  return out.join(' ').trim();
}

function walk(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as { type?: string; text?: unknown; content?: unknown };
  if (obj.type === 'text' && typeof obj.text === 'string') out.push(obj.text);
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) walk(child, out);
  }
}

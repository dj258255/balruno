'use client';

/**
 * Inbox popover for the user's unread @mention list (ADR 0024 Stage G).
 * Anchored to the sidebar's Inbox QuickLink — that's the trigger the
 * user clicks; this component just renders the popover next to it
 * via portal+fixed so the sidebar's overflow chain can't clip it.
 *
 * MVP scope deliberately small:
 *   - No "mark read" action yet — backend Mention.read_at is set
 *     when the user opens the *comment thread*, not when they
 *     glance at the inbox. (Stage H tracks this.)
 *   - Polls once per visible-tab cycle + on every comment-event
 *     broadcast. Real-time push without polling = cheap addition
 *     once the wss bridge gains a 'comment.mention' fan-out.
 */

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { listInbox, type BackendComment } from '@/lib/backend';
import { useInbox } from '@/stores/inboxStore';
import { CommentBody } from './CommentBody';

const POLL_MS = 60_000;

interface InboxBellProps {
  /**
   * The button this popover anchors to (the sidebar's Inbox QuickLink).
   * The popover sits to the *right* of the button so the sidebar
   * stays visible behind it.
   */
  anchorRef: RefObject<HTMLElement | null>;
}

export function InboxBell({ anchorRef }: InboxBellProps) {
  const open = useInbox((s) => s.open);
  const closeInbox = useInbox((s) => s.closeInbox);
  const [items, setItems] = useState<BackendComment[]>([]);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refetch = async () => {
      try {
        const list = await listInbox(20);
        if (!cancelled) setItems(list);
      } catch {
        // Inbox is best-effort; failures stay silent.
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

  // Re-anchor on open + on viewport / scroll changes so the popover
  // tracks the sidebar button if the layout reflows underneath it.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setPos({ left: rect.right + 8, top: rect.top });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  // Click-outside dismiss. The anchor button is excluded so its own
  // toggle action (sidebar QuickLink) keeps working — without this
  // the mousedown-first listener would close *before* the button's
  // onClick had a chance to flip the store state back open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      closeInbox();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, anchorRef, closeInbox]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 rounded-md border shadow-lg"
      style={{
        left: pos.left,
        top: pos.top,
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
              <CommentBody
                body={c.bodyJson}
                className="line-clamp-2 text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}

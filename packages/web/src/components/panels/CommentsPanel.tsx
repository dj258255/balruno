'use client';

/**
 * CommentsPanel — placeholder pending v0.7 server-canonical comments rewire.
 *
 * Original (v0.5) read from a Y.Doc-backed `lib/cellComments` store.
 * v0.6 cleanup removed the Y.Doc layer; the server-canonical
 * replacement (REST + push at `/api/v1/projects/:id/comments`) lands
 * in a follow-up phase. The panel keeps its dock slot so the
 * Comments button is consistent with v0.5; the body renders a
 * transparent placeholder until the read/write paths are reattached.
 */

import { MessageSquare } from 'lucide-react';

interface CommentsPanelProps {
  onClose?: () => void;
  isPanel?: boolean;
}

export default function CommentsPanel({ onClose }: CommentsPanelProps) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm"
      style={{ color: 'var(--text-secondary)' }}
    >
      <MessageSquare className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
      <p>코멘트는 server-canonical 버전과 다시 연결 중입니다.</p>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        (v0.7 phase, 백엔드 /api/v1/projects/:id/comments 사용 예정)
      </p>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="mt-2 rounded-md border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          닫기
        </button>
      ) : null}
    </div>
  );
}

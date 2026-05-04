import { MessageCircle } from 'lucide-react';
import { useCommentsStore } from '@/stores/commentsStore';
import type { CommentTarget } from '@/types/comments';

interface CommentBadgeProps {
  projectId: string;
  target: CommentTarget;
  onClick?: () => void;
}

/**
 * Small badge shown on cells / rows / sheets that have unresolved threads.
 * Click opens the comment side panel filtered to this target.
 */
export function CommentBadge({ projectId, target, onClick }: CommentBadgeProps) {
  const threads = useCommentsStore((s) => s.threadsFor(projectId, target));
  const unresolvedCount = threads.filter((t) => !t.resolved).length;

  if (unresolvedCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
      title={`${unresolvedCount} comment${unresolvedCount > 1 ? 's' : ''}`}
    >
      <MessageCircle className="w-2.5 h-2.5" />
      {unresolvedCount}
    </button>
  );
}

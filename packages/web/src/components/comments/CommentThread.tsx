import { useState, type FormEvent } from 'react';
import { Check, MoreHorizontal, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CommentThread as Thread } from '@/types/comments';
import { useCommentsStore } from '@/stores/commentsStore';
import { useAuthStore } from '@/stores/authStore';

interface CommentThreadProps {
  projectId: string;
  thread: Thread;
}

export function CommentThread({ projectId, thread }: CommentThreadProps) {
  const t = useTranslations('comments');
  const user = useAuthStore((s) => s.user);
  const reply = useCommentsStore((s) => s.reply);
  const resolve = useCommentsStore((s) => s.resolve);
  const remove = useCommentsStore((s) => s.remove);
  const deleteThread = useCommentsStore((s) => s.deleteThread);

  const [draft, setDraft] = useState('');

  const submitReply = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !user) return;
    reply(projectId, thread.id, {
      authorId: user.id,
      authorName: user.name,
      authorColor: hashColor(user.id),
      body: draft.trim(),
    });
    setDraft('');
  };

  return (
    <div
      className="border rounded-lg p-3 mb-3"
      style={{
        background: thread.resolved ? 'var(--bg-secondary)' : 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        opacity: thread.resolved ? 0.7 : 1,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {targetLabel(t, thread.target)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => resolve(projectId, thread.id, !thread.resolved)}
            className="p-1 rounded hover:bg-[var(--bg-hover)]"
            aria-label={thread.resolved ? t('reopen') : t('resolve')}
            title={thread.resolved ? t('reopen') : t('resolve')}
          >
            <Check
              className="w-3.5 h-3.5"
              style={{ color: thread.resolved ? '#22c55e' : 'var(--text-tertiary)' }}
            />
          </button>
          <button
            onClick={() => {
              if (window.confirm(t('confirmDelete'))) deleteThread(projectId, thread.id);
            }}
            className="p-1 rounded hover:bg-[var(--bg-hover)]"
            aria-label={t('deleteThread')}
            title={t('deleteThread')}
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>

      {thread.comments.map((c) => (
        <div key={c.id} className="mb-2 last:mb-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold text-white"
              style={{ background: c.authorColor }}
            >
              {c.authorName.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {c.authorName}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {formatTime(c.createdAt)}
              {c.editedAt && ` · ${t('edited')}`}
            </span>
            {user?.id === c.authorId && (
              <button
                onClick={() => remove(projectId, thread.id, c.id)}
                className="ml-auto p-0.5"
                aria-label={t('deleteComment')}
              >
                <MoreHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            )}
          </div>
          <div
            className="text-sm whitespace-pre-wrap pl-7"
            style={{ color: 'var(--text-primary)' }}
          >
            {c.body}
          </div>
        </div>
      ))}

      {!thread.resolved && (
        <form onSubmit={submitReply} className="mt-2 flex gap-2 pl-7">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('replyPlaceholder')}
            className="flex-1 px-2 py-1 text-sm rounded border outline-none"
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="px-2 py-1 text-xs rounded disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('reply')}
          </button>
        </form>
      )}
    </div>
  );
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function targetLabel(
  t: ReturnType<typeof useTranslations<'comments'>>,
  target: Thread['target'],
): string {
  switch (target.kind) {
    case 'cell':
      return t('targetCell');
    case 'row':
      return t('targetRow');
    case 'sheet':
      return t('targetSheet');
    case 'doc':
      return t('targetDoc');
    default:
      return '';
  }
}

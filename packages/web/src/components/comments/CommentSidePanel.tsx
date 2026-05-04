import { useMemo, useState, type FormEvent } from 'react';
import { X, MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CommentTarget } from '@/types/comments';
import { useCommentsStore } from '@/stores/commentsStore';
import { useAuthStore } from '@/stores/authStore';
import { CommentThread } from './CommentThread';

interface CommentSidePanelProps {
  projectId: string;
  /** Optional filter to a specific target — when null shows all unresolved threads. */
  filter?: CommentTarget | null;
  onClose: () => void;
  width?: number;
}

export function CommentSidePanel({
  projectId,
  filter = null,
  onClose,
  width = 360,
}: CommentSidePanelProps) {
  const t = useTranslations('comments');
  const user = useAuthStore((s) => s.user);
  const startThread = useCommentsStore((s) => s.startThread);
  const allThreads = useCommentsStore((s) => s.threadsByProject[projectId] ?? []);

  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState('');

  const visibleThreads = useMemo(() => {
    let list = allThreads;
    if (filter) {
      const key = `${filter.kind}:${'sheetId' in filter ? filter.sheetId : 'docId' in filter ? filter.docId : ''}`;
      list = list.filter((th) => {
        const tk = `${th.target.kind}:${'sheetId' in th.target ? th.target.sheetId : 'docId' in th.target ? th.target.docId : ''}`;
        return tk === key;
      });
    }
    if (!showResolved) list = list.filter((th) => !th.resolved);
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [allThreads, filter, showResolved]);

  const submitNew = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !user || !filter) return;
    startThread(projectId, filter, {
      authorId: user.id,
      authorName: user.name,
      authorColor: hashColor(user.id),
      body: draft.trim(),
    });
    setDraft('');
  };

  return (
    <aside
      className="fixed top-0 right-0 z-40 flex flex-col h-screen border-l shadow-lg"
      style={{
        width,
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('panelTitle', { count: visibleThreads.length })}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)]" aria-label="close">
          <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </header>

      <div
        className="px-4 py-2 border-b text-xs flex items-center justify-between"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}
      >
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          {t('showResolved')}
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {visibleThreads.length === 0 ? (
          <p className="text-sm text-center mt-6" style={{ color: 'var(--text-tertiary)' }}>
            {t('empty')}
          </p>
        ) : (
          visibleThreads.map((th) => (
            <CommentThread key={th.id} projectId={projectId} thread={th} />
          ))
        )}
      </div>

      {filter && user && (
        <form
          onSubmit={submitNew}
          className="border-t p-3 flex items-end gap-2"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('newPlaceholder')}
            rows={2}
            className="flex-1 px-2 py-1.5 text-sm rounded border outline-none resize-none"
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            {t('post')}
          </button>
        </form>
      )}
    </aside>
  );
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

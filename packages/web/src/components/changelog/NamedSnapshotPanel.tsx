import { useState, type FormEvent } from 'react';
import { Bookmark, Trash2, RotateCcw, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSnapshotsStore } from '@/stores/snapshotsStore';
import { useAuthStore } from '@/stores/authStore';

interface NamedSnapshotPanelProps {
  projectId: string;
  /** Provided by parent — current Project state (for snapshotting). */
  capturePayload: () => unknown;
  /** Restore handler — parent applies the given payload to the project. */
  onRestore: (payload: unknown) => void;
}

export function NamedSnapshotPanel({
  projectId,
  capturePayload,
  onRestore,
}: NamedSnapshotPanelProps) {
  const t = useTranslations('snapshots');
  const user = useAuthStore((s) => s.user);
  const list = useSnapshotsStore((s) => s.list(projectId));
  const add = useSnapshotsStore((s) => s.add);
  const rename = useSnapshotsStore((s) => s.rename);
  const remove = useSnapshotsStore((s) => s.remove);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    add(projectId, {
      name: name.trim(),
      createdBy: user?.id ?? 'local',
      payload: capturePayload(),
    });
    setName('');
    setCreating(false);
  };

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <h3
          className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          <Bookmark className="w-3.5 h-3.5" />
          {t('title')}
        </h3>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: 'var(--accent)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('newCta')}
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <input
            type="text"
            autoFocus
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded border outline-none"
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setName('');
              }}
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-2 py-1 text-xs rounded disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {t('save')}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
            {t('empty')}
          </p>
        ) : (
          list.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2 border-b group hover:bg-[var(--bg-hover)]"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt(t('renamePrompt'), s.name);
                    if (next && next.trim()) rename(projectId, s.id, next.trim());
                  }}
                  className="text-sm font-medium text-left flex-1 truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {s.name}
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('confirmRestore'))) onRestore(s.payload);
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                    title={t('restore')}
                  >
                    <RotateCcw className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('confirmDelete'))) remove(projectId, s.id);
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                    title={t('delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {formatTime(s.createdAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

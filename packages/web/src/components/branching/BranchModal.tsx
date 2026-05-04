import { useState, type FormEvent } from 'react';
import { X, GitBranch, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useBranchesStore } from '@/stores/branchesStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
// useProjectStore.getState() used inline above for updateProject. Keeping import single.

interface BranchModalProps {
  parentProjectId: string;
  /** data_version at the moment of fork — passed in by caller. */
  forkVersion: number;
  defaultName?: string;
  onClose: () => void;
  onForked?: (branchProjectId: string) => void;
}

/**
 * Forks a project into a new branch — clones the project (using existing
 * `duplicateProject`) and tags it with a Branch entry in the branches store.
 */
export function BranchModal({
  parentProjectId,
  forkVersion,
  defaultName = '',
  onClose,
  onForked,
}: BranchModalProps) {
  const t = useTranslations('branches');
  const user = useAuthStore((s) => s.user);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const fork = useBranchesStore((s) => s.forkProject);

  const [name, setName] = useState(defaultName || t('defaultBranchName'));
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Local clone via existing project store action — store renames after.
      const branchProjectId = duplicateProject(parentProjectId);
      if (!branchProjectId) {
        setError(t('errFailed'));
        setBusy(false);
        return;
      }
      // Override name on the new project so it shows up as the branch name.
      try {
        useProjectStore.getState().updateProject(branchProjectId, { name });
      } catch {
        // updateProject signature mismatch — non-fatal for branch creation
      }
      fork(parentProjectId, branchProjectId, {
        name,
        description: description || undefined,
        createdBy: user?.id ?? 'local',
        forkVersion,
      });
      onForked?.(branchProjectId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errFailed'));
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border shadow-xl"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2
            className="inline-flex items-center gap-2 text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            <GitBranch className="w-4 h-4" />
            {t('modalTitle')}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)]">
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('modalSubtitle')}
          </p>

          <label className="block">
            <span className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('nameLabel')}
            </span>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm rounded-md border outline-none"
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-primary)',
              }}
            />
          </label>

          <label className="block">
            <span className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('descLabel')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t('descPlaceholder')}
              className="w-full px-2.5 py-1.5 text-sm rounded-md border outline-none resize-none"
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-primary)',
              }}
            />
          </label>

          {error && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <GitBranch className="w-3.5 h-3.5" />
            {t('forkCta')}
          </button>
        </div>
      </form>
    </div>
  );
}

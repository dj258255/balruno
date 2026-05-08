import { useState } from 'react';
import { GitBranch, ChevronDown, Plus, Check, Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useBranchesStore } from '@/stores/branchesStore';
import { useProjectStore } from '@/stores/projectStore';
import { BranchModal } from './BranchModal';

interface BranchSwitcherProps {
  projectId: string;
  /** data_version at this moment, used as the fork point for new branches. */
  currentVersion?: number;
}

/**
 * Compact dropdown showing the current project's branches. Clicking switches
 * the active project to the branch's cloned project; "+ New branch" opens
 * the {@link BranchModal} fork dialog.
 */
export function BranchSwitcher({ projectId, currentVersion = 0 }: BranchSwitcherProps) {
  const t = useTranslations('branches');
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const branches = useBranchesStore((s) => s.branchesOf(projectId));
  const findByProject = useBranchesStore((s) => s.findByProject);

  const [open, setOpen] = useState(false);
  const [showFork, setShowFork] = useState(false);

  const onBranch = findByProject(projectId);
  const label = onBranch ? onBranch.name : t('mainBranch');

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border hover:bg-[var(--bg-hover)]"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <GitBranch className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          <span className="font-medium">{label}</span>
          <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1 z-30 min-w-[220px] rounded-lg shadow-lg border py-1"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <BranchRow
              label={t('mainBranch')}
              active={!onBranch}
              onClick={() => {
                if (onBranch) setCurrentProject(onBranch.parentProjectId);
                setOpen(false);
              }}
            />
            {branches.length > 0 && (
              <div
                className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('branchesHeading')}
              </div>
            )}
            {branches.map((b) => (
              <BranchRow
                key={b.id}
                label={b.name}
                active={onBranch?.id === b.id}
                badge={b.status === 'merged' ? t('merged') : b.status === 'archived' ? t('archived') : undefined}
                onClick={() => {
                  setCurrentProject(b.branchProjectId);
                  setOpen(false);
                }}
              />
            ))}
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowFork(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--accent)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('newBranch')}
            </button>
          </div>
        )}
      </div>

      {showFork && (
        <BranchModal
          parentProjectId={projectId}
          forkVersion={currentVersion}
          onClose={() => setShowFork(false)}
        />
      )}
    </>
  );
}

function BranchRow({
  label,
  active,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
      style={{ color: 'var(--text-primary)' }}
    >
      <span className="w-3.5 h-3.5 inline-flex items-center justify-center">
        {active ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} /> : null}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {badge && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          {badge === 'archived' && <Archive className="w-2.5 h-2.5" />}
          {badge}
        </span>
      )}
    </button>
  );
}

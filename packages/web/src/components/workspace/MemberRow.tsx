import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  changeMemberRole,
  removeMember,
  type WorkspaceMemberView,
  type WorkspaceRole,
} from '@/lib/backend';
import { UserAvatar } from '@/components/presence/UserAvatar';

interface MemberRowProps {
  workspaceId: string;
  member: WorkspaceMemberView;
  /** Current viewer's role — only owner/admin may mutate. */
  viewerRole: WorkspaceRole;
  onChanged?: () => void;
}

/**
 * One row of the members list. The role select offers all five tiers
 * except OWNER — ownership is transferred via a dedicated flow (not yet
 * built), never granted casually from a dropdown.
 */
export function MemberRow({ workspaceId, member, viewerRole, onChanged }: MemberRowProps) {
  const t = useTranslations('members');
  const [busy, setBusy] = useState(false);

  const canMutate =
    (viewerRole === 'OWNER' || viewerRole === 'ADMIN') && member.role !== 'OWNER';

  const displayName = member.user?.name ?? member.user?.email ?? t('deletedUser');
  const subText = member.user?.email ?? member.userId;

  const onRoleSelect = async (next: WorkspaceRole) => {
    if (next === member.role) return;
    setBusy(true);
    try {
      await changeMemberRole(workspaceId, member.userId, next);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const onRemoveClick = async () => {
    if (!window.confirm(t('confirmRemove', { name: displayName }))) return;
    setBusy(true);
    try {
      await removeMember(workspaceId, member.userId);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
      style={{ opacity: busy ? 0.5 : 1 }}
    >
      <UserAvatar
        user={{
          userId: member.userId,
          displayName,
          color: hashColor(member.userId),
        }}
        size={32}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {displayName}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
          {subText}
        </div>
      </div>

      {canMutate ? (
        <select
          value={member.role}
          disabled={busy}
          onChange={(e) => onRoleSelect(e.target.value as WorkspaceRole)}
          className="px-2 py-1 text-xs rounded-md border"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <option value="VIEWER">{t('roleViewer')}</option>
          <option value="EDITOR">{t('roleEditor')}</option>
          <option value="BUILDER">{t('roleBuilder')}</option>
          <option value="ADMIN">{t('roleAdmin')}</option>
        </select>
      ) : (
        <span
          className="px-2 py-1 text-xs rounded-md"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          {t(roleI18nKey(member.role))}
        </span>
      )}

      {canMutate && (
        <button
          onClick={onRemoveClick}
          disabled={busy}
          className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)]"
          aria-label={t('remove')}
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      )}
    </div>
  );
}

function roleI18nKey(role: WorkspaceRole): 'roleOwner' | 'roleAdmin' | 'roleBuilder' | 'roleEditor' | 'roleViewer' {
  switch (role) {
    case 'OWNER':   return 'roleOwner';
    case 'ADMIN':   return 'roleAdmin';
    case 'BUILDER': return 'roleBuilder';
    case 'EDITOR':  return 'roleEditor';
    case 'VIEWER':  return 'roleViewer';
  }
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

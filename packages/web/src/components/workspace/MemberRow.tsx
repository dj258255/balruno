import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  workspaceApi,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@/lib/api/workspaces';
import { UserAvatar } from '@/components/presence/UserAvatar';

interface MemberRowProps {
  workspaceId: string;
  member: WorkspaceMember;
  /** Current viewer's role — only owner/admin may mutate. */
  viewerRole: WorkspaceRole;
  onChanged?: () => void;
}

export function MemberRow({ workspaceId, member, viewerRole, onChanged }: MemberRowProps) {
  const t = useTranslations('members');
  const [busy, setBusy] = useState(false);

  const canMutate = (viewerRole === 'owner' || viewerRole === 'admin') && member.role !== 'owner';

  const changeRole = async (next: WorkspaceRole) => {
    if (next === member.role) return;
    setBusy(true);
    try {
      await workspaceApi.changeRole(workspaceId, member.userId, next);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('confirmRemove', { name: member.displayName }))) return;
    setBusy(true);
    try {
      await workspaceApi.removeMember(workspaceId, member.userId);
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
          displayName: member.displayName,
          color: hashColor(member.userId),
        }}
        size={32}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {member.displayName}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
          {member.email}
        </div>
      </div>

      {canMutate ? (
        <select
          value={member.role}
          disabled={busy}
          onChange={(e) => changeRole(e.target.value as WorkspaceRole)}
          className="px-2 py-1 text-xs rounded-md border"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <option value="viewer">{t('roleViewer')}</option>
          <option value="editor">{t('roleEditor')}</option>
          <option value="admin">{t('roleAdmin')}</option>
        </select>
      ) : (
        <span
          className="px-2 py-1 text-xs rounded-md"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          {member.role === 'owner' ? t('roleOwner') : t(`role${capitalize(member.role)}` as 'roleViewer')}
        </span>
      )}

      {canMutate && (
        <button
          onClick={remove}
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

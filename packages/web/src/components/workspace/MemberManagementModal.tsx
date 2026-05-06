import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  BackendError,
  listInvites,
  listWorkspaceMembers,
  revokeInvite,
  type WorkspaceInvite,
  type WorkspaceMemberView,
  type WorkspaceRole,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { InviteMemberForm } from './InviteMemberForm';
import { MemberRow } from './MemberRow';

interface MemberManagementModalProps {
  workspaceId: string;
  onClose: () => void;
}

export function MemberManagementModal({ workspaceId, onClose }: MemberManagementModalProps) {
  const t = useTranslations('members');
  const currentUserId = useBackendAuthStore((s) => s.user?.id);

  const [members, setMembers] = useState<WorkspaceMemberView[]>([]);
  const [pending, setPending] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await listWorkspaceMembers(workspaceId);
      // Listing invites needs Admin+; non-admin viewers shouldn't see the
      // pending section at all, so a 403 here is "swallow and skip" rather
      // than an error.
      const inv = await listInvites(workspaceId).catch((e) => {
        if (e instanceof BackendError && e.isForbidden) return [] as WorkspaceInvite[];
        throw e;
      });
      setMembers(m);
      setPending(inv.filter((i) => !i.acceptedAt && !i.revokedAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const viewerRole: WorkspaceRole =
    members.find((m) => m.userId === currentUserId)?.role ?? 'VIEWER';
  const canAdmin = viewerRole === 'OWNER' || viewerRole === 'ADMIN';

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border shadow-xl flex flex-col"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-hover)]">
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {canAdmin && (
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <InviteMemberForm workspaceId={workspaceId} onInvited={reload} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          )}
          {error && (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          {!loading && !error && (
            <>
              <SectionLabel>{t('membersHeading', { count: members.length })}</SectionLabel>
              {members.map((m) => (
                <MemberRow
                  key={m.userId}
                  workspaceId={workspaceId}
                  member={m}
                  viewerRole={viewerRole}
                  onChanged={reload}
                />
              ))}

              {pending.length > 0 && canAdmin && (
                <>
                  <SectionLabel>{t('pendingHeading', { count: pending.length })}</SectionLabel>
                  {pending.map((inv) => (
                    <PendingRow
                      key={inv.id}
                      workspaceId={workspaceId}
                      invite={inv}
                      onRevoked={reload}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: 'var(--text-tertiary)' }}
    >
      {children}
    </div>
  );
}

function PendingRow({
  workspaceId,
  invite,
  onRevoked,
}: {
  workspaceId: string;
  invite: WorkspaceInvite;
  onRevoked: () => void;
}) {
  const t = useTranslations('members');
  const [busy, setBusy] = useState(false);
  const revoke = async () => {
    setBusy(true);
    try {
      await revokeInvite(workspaceId, invite.id);
      onRevoked();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--bg-hover)]">
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {t('invitedAs', { role: t(roleI18nKey(invite.role)) })}
        </div>
        <div className="text-xs truncate font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {invite.id.slice(0, 8)}…
        </div>
      </div>
      <button
        onClick={revoke}
        disabled={busy}
        className="text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('cancelInvite')}
      </button>
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

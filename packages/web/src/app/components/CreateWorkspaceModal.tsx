'use client';

/**
 * Notion-style "Create workspace" modal — two-step flow:
 *
 *   Step 1: kind chooser
 *     - 개인용 (personal) — auto-creates with the user's display name,
 *       no extra prompts. Slug is derived from the user id so the
 *       URL is stable + globally unique.
 *     - 업무용 (team) — prompts for a team name then immediately
 *       walks the user into the invite step.
 *
 *   Step 2 (team only): name input → create
 *   Step 3 (team only): invite step (email + role) → done
 *
 * Both paths land on /{wsSlug} when complete. Centered portal
 * overlay so it shares the same modal pattern as workspace /
 * account / notification settings + member management.
 */

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Briefcase, User, ArrowLeft, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  BackendError,
  createWorkspace,
  createInvite,
  type Workspace,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { useWorkspaceListStore } from '@/stores/workspaceListStore';
import { InviteMemberForm } from '@/components/workspace/InviteMemberForm';

type Step = 'kind' | 'team-name' | 'team-invite';

interface CreateWorkspaceModalProps {
  onClose: () => void;
}

export default function CreateWorkspaceModal({ onClose }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const refreshWorkspaceList = useWorkspaceListStore((s) => s.refresh);
  const me = useBackendAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>('kind');
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [created, setCreated] = useState<Workspace | null>(null);

  // Personal: derive slug from user id (stable + globally unique)
  // and use the user's display name. One click, no prompt.
  const handlePersonal = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const slugBase = me
        ? `user-${me.id.replace(/-/g, '').slice(0, 8)}`
        : `ws-${Math.random().toString(36).slice(2, 10)}`;
      const wsName = me?.name ? `${me.name}'s Workspace` : '내 워크스페이스';
      const ws = await createWorkspace(slugBase, wsName);
      await refreshWorkspaceList();
      onClose();
      router.push(`/${ws.slug}`);
    } catch (e) {
      const msg = e instanceof BackendError && e.code === 'SLUG_TAKEN'
        ? '이미 같은 슬러그의 워크스페이스가 있습니다 (재시도하면 다른 슬러그로 만들어드려요)'
        : e instanceof Error ? e.message : '워크스페이스 생성 실패';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateTeam = async () => {
    if (creating || !teamName.trim()) return;
    setCreating(true);
    try {
      // Slug = team name lowered + sanitised + 6-char suffix to avoid
      // collisions. The user can rename in workspace settings later.
      const sanitised = teamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20) || 'team';
      const suffix = Math.random().toString(36).slice(2, 8);
      const slug = `${sanitised}-${suffix}`;
      const ws = await createWorkspace(slug, teamName.trim());
      await refreshWorkspaceList();
      setCreated(ws);
      setStep('team-invite');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '팀 워크스페이스 생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleFinishTeam = () => {
    if (!created) return;
    onClose();
    router.push(`/${created.slug}`);
  };

  // Auto-invite a single email when typed in the invite step. Creates
  // an unsigned link with the default editor role; the user can copy
  // it and send out-of-band, or just close the modal and rely on
  // Member Management later.
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const handleQuickInvite = async () => {
    if (!created || !inviteEmail.trim() || inviting) return;
    setInviting(true);
    try {
      await createInvite(created.id, { role: 'EDITOR', expiresIn: 'P7D' });
      toast.success('초대 링크를 만들었습니다 — 멤버 관리에서 링크를 복사해 보내세요');
      setInviteEmail('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '초대 실패');
    } finally {
      setInviting(false);
    }
  };

  return wrapShell(
    <>
      {step === 'kind' && (
        <div className="space-y-6">
          <header>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              새 워크스페이스
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              어떤 용도로 만드시나요?
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2">
            <KindCard
              icon={<User className="h-6 w-6" />}
              title="개인용"
              body="혼자 게임 밸런싱. 바로 시작."
              onClick={handlePersonal}
              disabled={creating}
              loading={creating}
            />
            <KindCard
              icon={<Briefcase className="h-6 w-6" />}
              title="업무용"
              body="팀과 함께. 멤버 초대 후 시작."
              onClick={() => setStep('team-name')}
              disabled={creating}
            />
          </div>
        </div>
      )}

      {step === 'team-name' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('kind')}
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-3 w-3" /> 뒤로
          </button>
          <header>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              팀 이름
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              팀 이름은 나중에 워크스페이스 설정에서 바꿀 수 있어요.
            </p>
          </header>
          <input
            type="text"
            autoFocus
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTeam();
            }}
            placeholder="예: Acme Studio"
            maxLength={80}
            disabled={creating}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreateTeam}
              disabled={creating || !teamName.trim()}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {creating ? '만드는 중...' : '계속'}
            </button>
          </div>
        </div>
      )}

      {step === 'team-invite' && created && (
        <div className="space-y-6">
          <header>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              팀원 초대
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              지금 초대해도 되고, 나중에 멤버 관리에서 추가해도 돼요.
            </p>
          </header>

          <div
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
          >
            <InviteMemberForm
              workspaceId={created.id}
              onInvited={() => {
                /* InviteMemberForm shows its own toast; nothing more
                   needed here since the modal closes via "건너뛰기". */
              }}
            />
            {/* Quick-create-link as alternate: yields an editor invite
                link the user can copy from the Member Management
                modal. Hidden behind a divider so the standard form
                stays primary. */}
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer" style={{ color: 'var(--text-tertiary)' }}>
                또는 7일짜리 초대 링크 만들기
              </summary>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="(메모용 — 링크는 어차피 누구나 사용 가능)"
                  className="flex-1 rounded border px-2 py-1 text-xs"
                  style={{ borderColor: 'var(--border-primary)', background: 'transparent', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={handleQuickInvite}
                  disabled={inviting}
                  className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  {inviting ? <Loader2 className="h-3 w-3 animate-spin" /> : '링크 만들기'}
                </button>
              </div>
            </details>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleFinishTeam}
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              건너뛰기 →
            </button>
            <button
              type="button"
              onClick={handleFinishTeam}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              완료
            </button>
          </div>
        </div>
      )}
    </>,
    onClose,
  );
}

function KindCard({
  icon,
  title,
  body,
  onClick,
  disabled,
  loading,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  disabled: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-2 rounded-lg border p-5 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
    >
      <div className="flex items-center gap-3">
        <div style={{ color: 'var(--text-secondary)' }}>{icon}</div>
        <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
          {loading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {body}
      </p>
    </button>
  );
}

function wrapShell(body: ReactNode, onClose: () => void): ReactNode {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border shadow-xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end p-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-hover)]" aria-label="close">
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{body}</div>
      </div>
    </div>,
    document.body,
  );
}

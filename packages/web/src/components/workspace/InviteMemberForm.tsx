import { useState } from 'react';
import { Link2, Copy, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  createInvite,
  inviteShareUrl,
  type WorkspaceRole,
} from '@/lib/backend';

interface InviteMemberFormProps {
  workspaceId: string;
  onInvited?: () => void;
}

const INVITE_TTL_DAYS = 7;

/**
 * Share-link invite. Creates a workspace_invites row, surfaces the raw
 * token exactly once (the backend never returns it again — stored as
 * SHA-256 hash), and offers a clipboard copy. Email invites are
 * deliberately gone — the backend's SMTP-free policy (ADR 0002) means
 * there's no server-side delivery path; the inviter shares the URL
 * themselves over whatever channel they prefer.
 */
export function InviteMemberForm({ workspaceId, onInvited }: InviteMemberFormProps) {
  const t = useTranslations('members');
  const [role, setRole] = useState<WorkspaceRole>('EDITOR');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setError(null);
    setGenerating(true);
    setShareUrl(null);
    setCopied(false);
    try {
      const created = await createInvite(workspaceId, {
        role,
        expiresIn: `P${INVITE_TTL_DAYS}D`,
      });
      const url = inviteShareUrl(created.rawToken);
      setShareUrl(url);
      onInvited?.();
      // Auto-copy on success — the button click is still the originating
      // gesture, so most browsers permit clipboard.writeText even after
      // an awaited fetch. If it fails (insecure context, denied
      // permission), the manual "복사" button remains as a fallback.
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success(t('inviteCopied'));
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* user can still click the manual copy button */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'failed';
      toast.error(msg);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('inviteCopied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('clipboard unavailable');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('inviteRoleLabel')}
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceRole)}
          disabled={generating}
          className="px-2 py-1.5 text-sm rounded-md border"
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
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {generating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
          {generating ? t('inviteCreating') : t('inviteCreate')}
        </button>
      </div>

      {shareUrl && (
        <div className="space-y-1">
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-md border"
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            <code
              className="flex-1 truncate text-xs font-mono"
              style={{ color: 'var(--text-primary)' }}
            >
              {shareUrl}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? t('inviteCopied') : t('inviteCopy')}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('inviteShareHint', { days: INVITE_TTL_DAYS })}
          </p>
        </div>
      )}

      {error && (
        <span className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { workspaceApi, type WorkspaceRole } from '@/lib/api/workspaces';

interface InviteMemberFormProps {
  workspaceId: string;
  onInvited?: () => void;
}

export function InviteMemberForm({ workspaceId, onInvited }: InviteMemberFormProps) {
  const t = useTranslations('members');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await workspaceApi.invite(workspaceId, email, role);
      setEmail('');
      onInvited?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        type="email"
        required
        placeholder={t('inviteEmailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 px-3 py-2 text-sm rounded-md border outline-none"
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-primary)',
        }}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as WorkspaceRole)}
        className="px-2 py-2 text-sm rounded-md border"
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
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md disabled:opacity-60"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        <Send className="w-3.5 h-3.5" />
        {t('invite')}
      </button>
      {error && (
        <span className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </form>
  );
}

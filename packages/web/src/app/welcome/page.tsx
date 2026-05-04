'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { workspaceApi } from '@/lib/api/workspaces';
import { projectApi } from '@/lib/api/projects';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { AuthShell } from '@/components/auth/AuthShell';
import { FormField } from '@/components/auth/FormField';
import { SubmitButton } from '@/components/auth/SubmitButton';

type Step = 'workspace' | 'project' | 'invite' | 'done';

export default function WelcomePage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userName = useAuthStore((s) => s.user?.name ?? '');

  const [step, setStep] = useState<Step>('workspace');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState(t('defaultWorkspaceName', { name: userName || 'My' }));
  const [projectName, setProjectName] = useState(t('defaultProjectName'));
  const [inviteEmails, setInviteEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <AuthShell title={t('mustLoginTitle')} subtitle={t('mustLogin')}>
        <Link href="/login" className="text-sm" style={{ color: 'var(--accent)' }}>
          {t('goLogin')}
        </Link>
      </AuthShell>
    );
  }

  const submitWorkspace = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ws = await workspaceApi.create(workspaceName);
      setWorkspaceId(ws.id);
      setStep('project');
    } catch (e) {
      setError(messageFromError(e, t));
    } finally {
      setLoading(false);
    }
  };

  const submitProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setError(null);
    setLoading(true);
    try {
      await projectApi.create(workspaceId, projectName);
      setStep('invite');
    } catch (e) {
      setError(messageFromError(e, t));
    } finally {
      setLoading(false);
    }
  };

  const submitInvites = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setError(null);
    setLoading(true);
    try {
      const emails = inviteEmails
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await Promise.all(emails.map((email) => workspaceApi.invite(workspaceId, email, 'editor')));
      setStep('done');
    } catch (e) {
      setError(messageFromError(e, t));
    } finally {
      setLoading(false);
    }
  };

  const skipInvites = () => setStep('done');

  return (
    <AuthShell title={t('title')} subtitle={t(`subtitle.${step}` as 'subtitle.workspace')}>
      <Stepper current={step} />

      {step === 'workspace' && (
        <form onSubmit={submitWorkspace} noValidate>
          <FormField
            name="workspaceName"
            label={t('workspaceNameLabel')}
            required
            autoFocus
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
          />
          <ErrorMessage error={error} />
          <SubmitButton loading={loading}>
            {t('next')} <ArrowRight className="w-4 h-4" />
          </SubmitButton>
        </form>
      )}

      {step === 'project' && (
        <form onSubmit={submitProject} noValidate>
          <FormField
            name="projectName"
            label={t('projectNameLabel')}
            required
            autoFocus
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <ErrorMessage error={error} />
          <SubmitButton loading={loading}>
            {t('next')} <ArrowRight className="w-4 h-4" />
          </SubmitButton>
        </form>
      )}

      {step === 'invite' && (
        <form onSubmit={submitInvites} noValidate>
          <FormField
            name="inviteEmails"
            label={t('inviteLabel')}
            placeholder={t('invitePlaceholder')}
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
          />
          <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('inviteHint')}
          </p>
          <ErrorMessage error={error} />
          <SubmitButton loading={loading}>{t('inviteCta')}</SubmitButton>
          <button
            type="button"
            onClick={skipInvites}
            className="mt-3 w-full text-center text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('inviteSkip')}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center">
          <Check className="mx-auto mb-3 w-10 h-10" style={{ color: '#22c55e' }} />
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('doneSubtitle')}
          </p>
          <button
            onClick={() => router.push(workspaceId ? `/?workspace=${workspaceId}` : '/')}
            className="w-full px-3 py-2.5 rounded-md font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('goWorkspace')}
          </button>
        </div>
      )}
    </AuthShell>
  );
}

function Stepper({ current }: { current: Step }) {
  const order: Step[] = ['workspace', 'project', 'invite', 'done'];
  const currentIndex = order.indexOf(current);
  return (
    <div className="mb-5 flex items-center gap-1">
      {order.map((s, i) => (
        <div
          key={s}
          className="h-1 flex-1 rounded-full"
          style={{ background: i <= currentIndex ? 'var(--accent)' : 'var(--bg-tertiary)' }}
        />
      ))}
    </div>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>
      {error}
    </p>
  );
}

function messageFromError(e: unknown, t: ReturnType<typeof useTranslations<'onboarding'>>): string {
  if (e instanceof ApiError) {
    if (e.code === 'NO_BACKEND') return t('errNoBackend');
    if (e.code === 'NETWORK') return t('errNetwork');
    return e.message;
  }
  return t('errGeneric');
}

'use client';

/**
 * Workspace settings page (/w/[slug]/settings).
 *
 * General section: rename + slug edit (PATCH /workspaces/{id}).
 * Plan section: shows the current plan; PRO/TEAM activate when billing ships.
 * Danger zone: delete with confirm-by-name friction (DangerConfirmDialog).
 *
 * Authorisation is enforced by the backend — non-admins hit 403 and see
 * the toast surface the error. No client-side role gate yet because the
 * /w/[slug] header doesn't compute role either; both will be tightened
 * when the workspace switcher resolves the caller's role per workspace.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  BackendError,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
  type Workspace,
  type WorkspacePlan,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { useWorkspaceListStore } from '@/stores/workspaceListStore';
import { DangerConfirmDialog } from '@/components/workspace/DangerConfirmDialog';

export default function WorkspaceSettingsPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const t = useTranslations('sidebar');
  const slug = params?.slug;

  const refreshList = useWorkspaceListStore((s) => s.refresh);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listWorkspaces();
        if (cancelled) return;
        const found = list.find((w) => w.slug === slug);
        if (!found) {
          setError('not-found');
          setLoading(false);
          return;
        }
        setWorkspace(found);
        setName(found.name);
        setSlugInput(found.slug);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof BackendError && e.isUnauthenticated) {
          useBackendAuthStore.getState().clear();
          router.replace('/login');
          return;
        }
        setError(e instanceof Error ? e.message : '워크스페이스를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  const dirty = workspace
    ? name.trim() !== workspace.name || slugInput.trim() !== workspace.slug
    : false;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setSaving(true);
    try {
      const patch: { name?: string; slug?: string } = {};
      if (name.trim() !== workspace.name) patch.name = name.trim();
      if (slugInput.trim() !== workspace.slug) patch.slug = slugInput.trim();
      const updated = await updateWorkspace(workspace.id, patch);
      setWorkspace(updated);
      setName(updated.name);
      setSlugInput(updated.slug);
      await refreshList();
      toast.success(t('settingsSaved'));
      // If slug changed, the URL we're on is now stale — bounce to the new one.
      if (patch.slug && updated.slug !== slug) {
        router.replace(`/w/${updated.slug}/settings`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace) return;
    setDeleting(true);
    try {
      await deleteWorkspace(workspace.id);
      await refreshList();
      toast.success(t('settingsDeleteSuccess'));
      router.replace('/workspaces');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'delete failed');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </main>
    );
  }

  if (error === 'not-found' || !workspace) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <button
          onClick={() => router.push('/workspaces')}
          className="mb-4 inline-flex items-center gap-1 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 워크스페이스 목록
        </button>
        <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          워크스페이스를 찾을 수 없습니다
        </h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <button
        onClick={() => router.push(`/w/${workspace.slug}`)}
        className="mb-4 inline-flex items-center gap-1 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t('settingsBack', { name: workspace.name })}
      </button>

      <h1 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text-primary)' }}>
        {t('settingsTitle')}
      </h1>

      {/* General — name + slug */}
      <form
        onSubmit={handleSave}
        className="mb-8 rounded-lg border p-5 space-y-4"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('settingsGeneral')}
        </h2>

        <Field
          label={t('settingsName')}
          hint={t('settingsNameHint')}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={120}
            disabled={saving}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
          />
        </Field>

        <Field
          label={t('settingsSlug')}
          hint={t('settingsSlugHint')}
        >
          <input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9][a-z0-9-]{2,29}"
            disabled={saving}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono disabled:opacity-50"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
          />
        </Field>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {saving ? t('settingsSaving') : t('settingsSave')}
          </button>
        </div>
      </form>

      {/* Plan readout — read-only until billing ships */}
      <div
        className="mb-8 rounded-lg border p-5"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-2 text-base font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('settingsPlan')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {planLine(t, workspace.plan)}
        </p>
      </div>

      {/* Danger zone */}
      <div
        className="rounded-lg border p-5"
        style={{ borderColor: '#dc2626', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-1 text-base font-medium" style={{ color: '#dc2626' }}>
          {t('settingsDangerZone')}
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('settingsDeleteHint')}
        </p>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{ borderColor: '#dc2626', color: '#dc2626' }}
        >
          {t('settingsDelete')}
        </button>
      </div>

      <DangerConfirmDialog
        open={confirmOpen}
        title={t('settingsDeleteConfirmTitle')}
        description={t('settingsDeleteConfirmBody', { name: workspace.name })}
        confirmWord={workspace.name}
        confirmLabel={t('settingsDeleteConfirmAction')}
        cancelLabel={t('confirmCancel')}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}

function planLine(
  t: ReturnType<typeof useTranslations<'sidebar'>>,
  plan: WorkspacePlan,
): string {
  switch (plan) {
    case 'FREE': return t('settingsPlanFree');
    case 'PRO':  return t('settingsPlanPro');
    case 'TEAM': return t('settingsPlanTeam');
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
      )}
    </div>
  );
}

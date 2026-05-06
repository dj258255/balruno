'use client';

/**
 * Workspace detail page (/w/[slug]).
 *
 * Resolves slug → workspace by listing the caller's workspaces and
 * filtering — backend has no /workspaces/by-slug endpoint and adding one
 * would just trade an extra round-trip for a one-line client-side find.
 * If the slug isn't in the caller's list (either nonexistent or the
 * caller isn't a member) the same "not found" UI fires — same as
 * Linear / Notion: not-a-member is indistinguishable from not-existing,
 * which is the correct privacy posture.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users, Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  BackendError,
  createProject,
  listProjects,
  listWorkspaces,
  type Project,
  type Workspace,
  type WorkspacePlan,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { MemberManagementModal } from '@/components/workspace/MemberManagementModal';

export default function WorkspaceDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');

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
        const ps = await listProjects(found.id);
        if (cancelled) return;
        setProjects(ps);
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setCreating(true);
    try {
      const created = await createProject(workspace.id, {
        slug: newSlug.trim(),
        name: newName.trim(),
      });
      setProjects((prev) => (prev ? [...prev, created] : [created]));
      setNewSlug('');
      setNewName('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '프로젝트를 만들지 못했습니다.';
      toast.error(msg);
      setError(msg);
    } finally {
      setCreating(false);
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
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          이 슬러그의 워크스페이스가 없거나 멤버가 아닙니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <button
        onClick={() => router.push('/workspaces')}
        className="mb-4 inline-flex items-center gap-1 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> 워크스페이스 목록
      </button>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {workspace.name}
            </h1>
            <PlanBadge plan={workspace.plan} />
          </div>
          <p className="mt-1 text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
            /{workspace.slug}
          </p>
        </div>
        <button
          onClick={() => setMembersOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <Users className="w-3.5 h-3.5" />
          멤버
        </button>
      </header>

      {error && error !== 'not-found' && (
        <p className="mb-4 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <section
        className="mb-6 rounded-lg border"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2
          className="px-4 py-3 text-base font-medium border-b"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
        >
          프로젝트 ({projects?.length ?? 0})
        </h2>
        {projects && projects.length === 0 && (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            아직 프로젝트가 없습니다. 아래에서 첫 프로젝트를 만드세요.
          </p>
        )}
        {projects && projects.length > 0 && (
          <ul>
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-t px-4 py-3"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.name}
                  </div>
                  {p.description && (
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {p.description}
                    </div>
                  )}
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  /{p.slug}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={handleCreate}
        className="rounded-lg border p-5"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-3 text-base font-medium" style={{ color: 'var(--text-primary)' }}>
          새 프로젝트 만들기
        </h2>
        <div className="space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="이름 (예: 메인 게임)"
            required
            minLength={1}
            maxLength={120}
            disabled={creating}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
          />
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
            placeholder="slug (a-z, 0-9, -)"
            required
            pattern="[a-z0-9][a-z0-9-]{2,29}"
            disabled={creating}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono disabled:opacity-50"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
          />
          <button
            type="submit"
            disabled={creating || !newSlug || !newName}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Plus className="w-3.5 h-3.5" />
            {creating ? '만드는 중...' : '만들기'}
          </button>
        </div>
      </form>

      {membersOpen && (
        <MemberManagementModal
          workspaceId={workspace.id}
          onClose={() => setMembersOpen(false)}
        />
      )}
    </main>
  );
}

function PlanBadge({ plan }: { plan: WorkspacePlan }) {
  const styles =
    plan === 'FREE'
      ? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
      : plan === 'PRO'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
        : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-mono ${styles}`}>{plan}</span>
  );
}

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
import { Users, Plus, ArrowLeft, Loader2, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import {
  BackendError,
  createProject,
  deleteProject,
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
  const t = useTranslations('sidebar');
  const slug = params?.slug;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        // Always land on a project — pick the one the user opened
        // most recently (localStorage hint), falling back to the
        // most-recently-updated. The workspace home is reached via
        // breadcrumb / sidebar back when the user actively wants
        // the picker. Linear / Notion / Figma pattern.
        if (ps.length > 0) {
          let target = ps[0];
          if (typeof window !== 'undefined') {
            const lastSlug = window.localStorage.getItem(`balruno:lastProject:${found.slug}`);
            const lastMatch = lastSlug ? ps.find((p) => p.slug === lastSlug) : null;
            if (lastMatch) {
              target = lastMatch;
            } else {
              // Pick the most-recently-updated project so refresh
              // lands on the same place as a sidebar 'recent' click
              // would.
              target = ps.reduce(
                (best, p) =>
                  new Date(p.updatedAt).getTime() > new Date(best.updatedAt).getTime()
                    ? p
                    : best,
                ps[0],
              );
            }
          }
          router.replace(`/w/${found.slug}/p/${target.slug}`);
          return;
        }
        // Zero-project workspace — accounts that pre-date the
        // OAuth-callback auto-create or that deleted their default.
        // Auto-seed a fresh project with the full starter pack
        // (ADR 0020) so the user lands on populated content
        // instead of a blank create form (the v0.5 onboarding
        // pattern the user explicitly asked us to keep).
        try {
          const created = await createProject(found.id, {
            slug: 'main',
            name: '내 첫 게임',
            withStarterPack: true,
          });
          if (cancelled) return;
          router.replace(`/w/${found.slug}/p/${created.slug}`);
          return;
        } catch (seedErr) {
          // Fall through to the picker page so the user can retry
          // manually if the seed fails (e.g. quota cap, slug taken
          // from a partially-deleted prior project).
          if (cancelled) return;
          setError(seedErr instanceof Error ? seedErr.message : '기본 프로젝트를 만들지 못했습니다.');
        }
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

  // Hard delete a project — server-side it's a soft delete, the row
  // gets deleted_at set so future imports / sync drops it. Confirm
  // dialog is window.confirm for now (no shared ConfirmDialog wired
  // here yet); the destructive action is irreversible from the UI's
  // POV so the explicit prompt is a guardrail worth keeping.
  const handleDelete = async (p: Project) => {
    const confirmed = window.confirm(
      `프로젝트 "${p.name}"을(를) 삭제할까요?\n\n시트, 문서, 셀 데이터가 모두 함께 사라집니다.`,
    );
    if (!confirmed) return;
    setDeletingId(p.id);
    try {
      await deleteProject(p.id);
      setProjects((prev) => prev?.filter((proj) => proj.id !== p.id) ?? null);
      toast.success(`"${p.name}" 삭제됨`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '프로젝트를 삭제하지 못했습니다.';
      toast.error(msg);
    } finally {
      setDeletingId(null);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMembersOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <Users className="w-3.5 h-3.5" />
            멤버
          </button>
          <button
            onClick={() => router.push(`/w/${workspace.slug}/settings`)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <Settings className="w-3.5 h-3.5" />
            {t('workspaceSettings')}
          </button>
        </div>
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
                className="group flex items-center border-t hover:bg-[var(--bg-hover)]"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <button
                  onClick={() => router.push(`/w/${workspace.slug}/p/${p.slug}`)}
                  className="flex flex-1 items-center justify-between px-4 py-3 text-left"
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
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  disabled={deletingId === p.id}
                  className="mr-3 rounded p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="프로젝트 삭제"
                >
                  {deletingId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The "새 프로젝트 만들기" form was removed in v0.7 — first
          login auto-seeds a starter-pack project via the OAuth
          callback, the empty-state path inline-creates one with
          ADR 0020 starters + redirects, and adding more projects
          lives behind the sidebar's "+ 새 게임" button which uses
          the same starter-pack seed. */}

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

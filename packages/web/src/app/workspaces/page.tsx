'use client';

/**
 * Minimal workspace list + create form.
 *
 * Loads the caller's workspaces and quota from the backend. The quota
 * surface drives two pieces of UX: a banner showing "X of Y workspaces"
 * for the caller's plan, and disabling the create form once the cap is
 * reached so the user sees the limit before the backend's 403 fires.
 */

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  BackendError,
  createWorkspace,
  deleteWorkspace,
  fetchUserQuota,
  listWorkspaces,
  type UserQuota,
  type Workspace,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, q] = await Promise.all([listWorkspaces(), fetchUserQuota()]);
        if (cancelled) return;
        // Single-workspace users skip the picker — Linear / Notion
        // pattern. The list page only earns its keep when the user
        // has 2+ workspaces or wants to create another.
        if (list.length === 1) {
          router.replace(`/w/${list[0].slug}`);
          return;
        }
        // Zero-workspace path — accounts that pre-date the OAuth
        // auto-create or that deleted their default workspace.
        // Seed one inline so the user never lands on an empty
        // create form (the v0.5 onboarding pattern the user
        // explicitly asked us to keep). Slug derived from the
        // logged-in user's id; name picks up the display name.
        if (list.length === 0) {
          const me = useBackendAuthStore.getState().user;
          const slugBase = me
            ? `user-${me.id.replace(/-/g, '').slice(0, 8)}`
            : `ws-${Math.random().toString(36).slice(2, 10)}`;
          const wsName = me?.name ? `${me.name}'s Workspace` : 'My Workspace';
          const created = await createWorkspace(slugBase, wsName);
          if (cancelled) return;
          router.replace(`/w/${created.slug}`);
          return;
        }
        setWorkspaces(list);
        setQuota(q);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof BackendError && e.isUnauthenticated) {
          useBackendAuthStore.getState().clear();
          router.replace('/login');
          return;
        }
        setError(e instanceof Error ? e.message : '워크스페이스를 불러오지 못했습니다.');
        setWorkspaces([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await createWorkspace(slug.trim(), name.trim());
      setWorkspaces((prev) => (prev ? [...prev, created] : [created]));
      // Re-fetch quota — ownedWorkspaces just changed.
      const q = await fetchUserQuota();
      setQuota(q);
      setSlug('');
      setName('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '워크스페이스를 만들지 못했습니다.';
      toast.error(msg);
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  // Workspace delete — only the owner role can; backend returns 403
  // for member / admin. Stronger confirm than project delete because
  // the cascade includes every project, sheet, doc and member invite.
  // Typed-name confirm forces the user to acknowledge what's being
  // deleted before the destructive call fires.
  const handleDeleteWorkspace = async (ws: Workspace) => {
    const typed = window.prompt(
      `워크스페이스 "${ws.name}" 을(를) 영구 삭제합니다.\n\n포함된 모든 프로젝트, 시트, 문서, 멤버가 함께 사라집니다. 되돌릴 수 없습니다.\n\n계속하려면 워크스페이스 이름 "${ws.name}" 을 그대로 입력하세요:`,
    );
    if (typed === null) return;
    if (typed.trim() !== ws.name) {
      toast.error('이름이 일치하지 않습니다. 삭제 취소.');
      return;
    }
    setDeletingId(ws.id);
    try {
      await deleteWorkspace(ws.id);
      setWorkspaces((prev) => prev?.filter((w) => w.id !== ws.id) ?? null);
      const q = await fetchUserQuota();
      setQuota(q);
      toast.success(`"${ws.name}" 삭제됨`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '워크스페이스를 삭제하지 못했습니다.';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        워크스페이스
      </h1>

      {quota && (
        <QuotaBanner quota={quota} />
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {workspaces === null ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>불러오는 중...</p>
      ) : workspaces.length === 0 ? (
        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          아직 워크스페이스가 없습니다. 아래에서 첫 워크스페이스를 만드세요.
        </p>
      ) : (
        <ul className="mb-8 space-y-2">
          {workspaces.map((ws) => (
            <li
              key={ws.id}
              className="group flex items-center rounded-lg border hover:bg-[var(--bg-hover)]"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
            >
              <Link
                href={`/w/${ws.slug}`}
                className="flex flex-1 items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {ws.name}
                  </span>
                  <PlanBadge plan={ws.plan} />
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  /{ws.slug}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => handleDeleteWorkspace(ws)}
                disabled={deletingId === ws.id}
                className="mr-3 rounded p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30"
                style={{ color: 'var(--text-tertiary)' }}
                title="워크스페이스 삭제"
              >
                {deletingId === ws.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The "새 워크스페이스 만들기" form was removed in v0.7 — first
          login auto-seeds via the OAuth callback, the empty-state
          path inline-creates a default workspace + redirects, and
          existing 2+ workspace users just use the picker above.
          Adding more workspaces is rare enough to live in the
          workspace settings menu rather than the front door. */}
    </main>
  );
}

function QuotaBanner({ quota }: { quota: UserQuota }) {
  return (
    <div
      className="mb-6 flex items-center justify-between rounded-lg border px-4 py-3"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        보유 워크스페이스
      </span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {quota.ownedWorkspaces}개
      </span>
    </div>
  );
}

function PlanBadge({ plan }: { plan: 'FREE' | 'PRO' | 'TEAM' }) {
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

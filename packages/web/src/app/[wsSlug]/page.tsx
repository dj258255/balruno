'use client';

/**
 * Workspace home — Linear-style URL `/{wsSlug}`.
 *
 * Mirror of `/w/[slug]/page.tsx`: resolves the workspace, auto-seeds
 * a starter-pack project on the empty path, and mounts WorkspaceShell
 * so the right pane shows the most-recently-visited project's content
 * immediately.
 *
 * Phase 1 of the URL migration adds this route additively — the
 * legacy `/w/{slug}` route still works. Phase 2 will redirect old →
 * new and flip internal link generation. Reserved-word validation
 * on the backend (workspace slug) prevents collisions with sibling
 * static routes (`/login`, `/pricing`, `/workspaces`, etc.).
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import {
  BackendError,
  createProject,
  listProjects,
  listWorkspaces,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import WorkspaceShell from '@/app/components/WorkspaceShell';

export default function WorkspaceHomeRoute() {
  const params = useParams<{ wsSlug: string }>();
  const router = useRouter();
  const slug = params?.wsSlug;

  const [phase, setPhase] = useState<'resolving' | 'shell' | 'not-found' | 'seeding'>('resolving');
  const seeded = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listWorkspaces();
        if (cancelled) return;
        const ws = list.find((w) => w.slug === slug);
        if (!ws) {
          setPhase('not-found');
          return;
        }
        const ps = await listProjects(ws.id);
        if (cancelled) return;
        if (ps.length > 0) {
          setPhase('shell');
          return;
        }
        if (seeded.current) return;
        seeded.current = true;
        setPhase('seeding');
        try {
          await createProject(ws.id, {
            slug: 'main',
            name: '내 첫 게임',
            withStarterPack: true,
          });
          if (cancelled) return;
          setPhase('shell');
        } catch (seedErr) {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.error('[workspace-home] auto-seed failed', seedErr);
          setPhase('not-found');
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof BackendError && e.isUnauthenticated) {
          useBackendAuthStore.getState().clear();
          router.replace('/login');
          return;
        }
        setPhase('not-found');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  if (phase === 'resolving' || phase === 'seeding') {
    return (
      <main className="h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </main>
    );
  }

  if (phase === 'not-found' || !slug) {
    return (
      <main className="h-screen flex flex-col items-center justify-center gap-2">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          워크스페이스를 찾을 수 없습니다.
        </p>
        <button
          type="button"
          onClick={() => router.replace('/workspaces')}
          className="text-sm hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          내 워크스페이스 목록으로
        </button>
      </main>
    );
  }

  return <WorkspaceShell workspaceSlug={slug} initialProjectSlug={null} />;
}

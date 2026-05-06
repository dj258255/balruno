'use client';

/**
 * Project detail page (/w/[slug]/p/[projectSlug]).
 *
 * The minimum viable bridge between the server-canonical workspace UI
 * and the project sync infrastructure (ADR 0017). Mounting this page
 * is what triggers the first {@code /ws/projects/{id}} WebSocket
 * connect and the {@code sync.full} hydrate frame; before this route
 * landed, the entire sync stack (Hocuspocus + Spring WS handler +
 * useProjectSync hook) was reachable only through tests / curl probes,
 * never through a real browser session.
 *
 * Slug → id resolution mirrors the /w/[slug] page: list the caller's
 * workspaces + projects and filter client-side. Same privacy posture
 * (not-a-member ≡ not-existing).
 *
 * The full sheet / doc editing UI from local mode (SheetTable, view
 * switcher, etc.) lives in {@code app/page.tsx} and depends on the
 * Y.Doc + IndexedDB store. Wiring it into the server-canonical flow
 * is a separate phase — that work has to bridge zustand + the doc
 * tree from sync.full + per-cell write paths into useProjectSync.
 * This page intentionally renders only the connection-status + a
 * placeholder so each phase ships behind a green CI run.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import {
  BackendError,
  listProjects,
  listWorkspaces,
  type Project,
  type Workspace,
} from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { useProjectSync } from '@/hooks/useProjectSync';
import { ConnectionStatus } from '@/components/sync/ConnectionStatus';

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string; projectSlug: string }>();
  const router = useRouter();
  const slug = params?.slug;
  const projectSlug = params?.projectSlug;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !projectSlug) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listWorkspaces();
        if (cancelled) return;
        const ws = list.find((w) => w.slug === slug);
        if (!ws) {
          setError('not-found');
          setLoading(false);
          return;
        }
        setWorkspace(ws);
        const ps = await listProjects(ws.id);
        if (cancelled) return;
        const p = ps.find((proj) => proj.slug === projectSlug);
        if (!p) {
          setError('not-found');
          setLoading(false);
          return;
        }
        setProject(p);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof BackendError && e.isUnauthenticated) {
          useBackendAuthStore.getState().clear();
          router.replace('/login');
          return;
        }
        setError(e instanceof Error ? e.message : '프로젝트를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, projectSlug, router]);

  // Sync hook stays idle while projectId is unknown; once the resolve
  // effect populates `project`, the hook opens /ws/projects/{id} and
  // backend pushes sync.full as the first frame.
  const { status: syncStatus } = useProjectSync({
    projectId: project?.id ?? null,
    enabled: Boolean(project),
  });

  if (loading) {
    return (
      <main className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </main>
    );
  }

  if (error === 'not-found' || !workspace || !project) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <button
          onClick={() => router.push(slug ? `/w/${slug}` : '/workspaces')}
          className="mb-4 inline-flex items-center gap-1 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 워크스페이스
        </button>
        <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          프로젝트를 찾을 수 없습니다
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          이 슬러그의 프로젝트가 없거나 멤버가 아닙니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <button
        onClick={() => router.push(`/w/${workspace.slug}`)}
        className="mb-4 inline-flex items-center gap-1 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {workspace.name}
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {project.name}
        </h1>
        <p className="mt-1 text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
          /{project.slug}
        </p>
        {error && error !== 'not-found' && (
          <p className="mt-2 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </header>

      <section
        className="rounded-lg border p-4 text-sm"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <div className="mb-2 flex items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>실시간 동기화 상태:</span>
          <ConnectionStatus />
          <code className="ml-2 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {syncStatus}
          </code>
        </div>
        <p style={{ color: 'var(--text-tertiary)' }}>
          본 페이지 진입 즉시 <code>/ws/projects/{project.id}</code> 에 WebSocket 이 연결되고,
          백엔드는 <code>sync.full</code> 첫 프레임으로 현재 프로젝트 상태를 hydrate 합니다.
          시트 편집 UI 의 server-canonical 통합은 다음 phase 에서 이어집니다.
        </p>
      </section>
    </main>
  );
}

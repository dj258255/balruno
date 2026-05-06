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
import { useProjectStore } from '@/stores/projectStore';
import { useProjectSyncBridge } from '@/hooks/useProjectSyncBridge';
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

  // Seed project metadata into the store as soon as the resolve
  // effect populates `project`. sync.full will replace .sheets
  // wholesale on arrival (Stage E.1's hydrateProjectFromSyncFull),
  // so seeding metadata first means the broadcast apply path always
  // has a project to attach to. The find guard makes the seed
  // idempotent against re-runs.
  useEffect(() => {
    if (!project) return;
    useProjectStore.setState((state) => {
      if (state.projects.find((p) => p.id === project.id)) return state;
      const now = Date.now();
      return {
        projects: [
          ...state.projects,
          {
            id: project.id,
            name: project.name,
            // backend Project.description is string | null, store
            // Project.description is string | undefined (optional);
            // coerce so the shape matches.
            description: project.description ?? undefined,
            sheets: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    });
  }, [project]);

  // Bridge stays idle while projectId is unknown; once the resolve
  // effect populates `project`, useProjectSyncBridge opens
  // /ws/projects/{id}, registers the live sender on the writeQueue,
  // and forwards sync.full / op.acked / broadcast frames into the
  // per-region baseVersions (ADR 0018 Stage B).
  const { status: syncStatus } = useProjectSyncBridge({
    projectId: project?.id ?? null,
    enabled: Boolean(project),
  });

  // Read the live sheet from the store — populated by hydrate from
  // sync.full. Falls back to undefined while the WS handshake races
  // with the resolve effect.
  const localProject = useProjectStore((state) =>
    project ? state.projects.find((p) => p.id === project.id) : undefined,
  );
  const updateCellAction = useProjectStore((state) => state.updateCell);
  const firstSheet = localProject?.sheets[0];
  const firstColumn = firstSheet?.columns[0];
  const firstRow = firstSheet?.rows[0];

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
        className="mb-4 rounded-lg border p-4 text-sm"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>실시간 동기화 상태:</span>
          <ConnectionStatus />
          <code className="ml-2 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {syncStatus}
          </code>
        </div>
      </section>

      {firstSheet && firstColumn && firstRow ? (
        <section
          className="rounded-lg border p-4"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
        >
          <h2 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {firstSheet.name}
          </h2>
          {/*
           * Minimal cell editor — Stage E.2 first cut. The full
           * SheetTable depends on ~6 zustand stores (history /
           * sheetUI / recordDetail / simulationPreload / ...) that
           * the local-mode home page sets up; mounting it here
           * needs a separate phase to mirror that hydrate. For
           * now this single input proves the keystroke -> store
           * -> writeQueue -> wss -> backend round-trip end-to-end.
           */}
          <label
            className="flex items-center gap-3 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="w-24 truncate" title={firstColumn.name}>
              {firstColumn.name}:
            </span>
            <input
              type="text"
              defaultValue={String(firstRow.cells[firstColumn.id] ?? '')}
              onBlur={(e) => {
                updateCellAction(
                  project.id,
                  firstSheet.id,
                  firstRow.id,
                  firstColumn.id,
                  e.target.value,
                );
              }}
              className="flex-1 rounded-md border px-3 py-2 font-mono text-sm"
              style={{
                borderColor: 'var(--border-primary)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
              placeholder="값 입력 후 다른 곳 클릭하면 동기화"
            />
          </label>
          <p className="mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            blur 시 cell.update 가 <code>/ws/projects/{project.id}</code> 로 emit. 다른 사용자가
            같은 프로젝트를 열고 있으면 broadcast 로 화면 자동 반영. 풀 SheetTable 통합은
            다음 phase.
          </p>
        </section>
      ) : (
        <section
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
        >
          <p style={{ color: 'var(--text-tertiary)' }}>
            <code>sync.full</code> 응답을 기다리는 중...
          </p>
        </section>
      )}
    </main>
  );
}

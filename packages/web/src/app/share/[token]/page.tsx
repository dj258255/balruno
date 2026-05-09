'use client';

/**
 * Public read-only share viewer (ADR 0027).
 *
 * Route: /share/:token
 * Auth: none — the URL token is the credential. Backend's
 * SecurityConfig permitAll's /api/v1/share-public/** so request()
 * with no JWT just works.
 *
 * The viewer renders the project snapshot frozen at fetch time —
 * no WebSocket subscription, no edits, no mutations. If the user
 * who minted the link revokes it, subsequent reloads show 404; the
 * page in front of them keeps its current frozen state until then
 * (we don't poll — read-only, ephemeral).
 *
 * Layout intentionally minimal: project name header, sheet picker
 * (when share covers the whole project), then the same SheetTable /
 * Kanban / ... view the editable mode renders, but with all
 * interactive handlers disabled at the table level (sheet pages
 * still subscribe to useProjectStore but nothing they emit goes
 * anywhere — write paths require WebSocket which we never connect).
 */

import { use, useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { fetchPublicShare, type PublicReadResponse } from '@/lib/backend';
import { useProjectStore } from '@/stores/projectStore';
import type { Project, Sheet } from '@/types';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function PublicSharePage({ params }: PageProps) {
  const { token } = use(params);
  const [data, setData] = useState<PublicReadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicShare(token)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Hydrate the local store with the snapshot so the existing
        // SheetTable / Kanban / ... components can read via the
        // standard useProjectStore selector. The whole page treats
        // this as a frozen one-shot — no emitOp, no WebSocket. Edits
        // would silently no-op (writeQueue.send returns early when
        // no sender is registered).
        const snap = res.projectSnapshot as {
          id: string;
          name: string;
          data?: { sheets?: Sheet[] };
          sheetTree?: unknown;
          docTree?: unknown;
        };
        const proj: Project = {
          id: snap.id,
          name: snap.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sheets: (snap.data?.sheets ?? []) as Sheet[],
          sheetTree: (snap.sheetTree as Project['sheetTree']) ?? [],
          docTree: (snap.docTree as Project['docTree']) ?? [],
        };
        useProjectStore.setState((s) => ({
          projects: [...s.projects.filter((p) => p.id !== proj.id), proj],
          currentProjectId: proj.id,
        }));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '링크를 찾을 수 없습니다');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-lg border p-6 text-center" style={{ borderColor: 'var(--border-primary)' }}>
          <Lock className="mx-auto mb-2 h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            이 링크는 유효하지 않거나 취소되었습니다.
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  const project = useProjectStore.getState().projects.find((p) => p.id === data.projectSnapshot.id) ?? null;
  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        프로젝트를 불러오지 못했습니다.
      </div>
    );
  }

  // Resolve sheet pin → sheet object. NULL pin = first sheet by tree
  // order (we list every sheet in a side picker so the viewer can
  // navigate). Null sheets array = empty project (rare; show notice).
  const pinnedSheetId = data.link.sheetId;
  const sheet =
    (pinnedSheetId && project.sheets.find((s) => s.id === pinnedSheetId)) ||
    project.sheets[0] ||
    null;
  if (!sheet) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        공유된 시트가 비어 있습니다.
      </div>
    );
  }

  // Apply view pin if set. Mutate the local snapshot's activeView so
  // the existing render branches in page.tsx reuse without a
  // public-specific code path. (Public viewer never emits — the
  // mutation is purely client-local.)
  if (data.link.activeView && sheet.activeView !== data.link.activeView) {
    sheet.activeView = data.link.activeView as Sheet['activeView'];
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <div>
          <h1 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {sheet.name}
            {data.link.expiresAt && (
              <span className="ml-2">
                · {new Date(data.link.expiresAt).toLocaleDateString()} 만료
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <Lock className="h-3 w-3" />
          읽기 전용 공유
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <PublicSheetBody projectId={project.id} sheet={sheet} />
      </main>
    </div>
  );
}

/**
 * Pick the right view component based on sheet.activeView. Mirrors
 * the editable project page's branch but without ViewSwitcher
 * (read-only — the viewer can't change the active view).
 *
 * Lazy-load each view so the public viewer's bundle stays small —
 * a recipient who clicks a Kanban link doesn't ship Curve / Heatmap
 * code.
 */
function PublicSheetBody({ projectId, sheet }: { projectId: string; sheet: Sheet }) {
  // Dynamic import so each view chunk lands separately. Top-level
  // `import` of all 10 views would stuff every render path into the
  // share bundle.
  const View = useViewComponent(sheet.activeView ?? 'grid');
  if (!View) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        뷰 로딩 중...
      </div>
    );
  }
  return <View projectId={projectId} sheet={sheet} />;
}

interface ViewProps {
  projectId: string;
  sheet: Sheet;
}

function useViewComponent(activeView: string) {
  const [Comp, setComp] = useState<React.ComponentType<ViewProps> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let mod: { default: React.ComponentType<ViewProps> } | { [k: string]: React.ComponentType<ViewProps> };
      switch (activeView) {
        case 'kanban':
          mod = await import('@/components/views/KanbanView');
          break;
        case 'calendar':
          mod = await import('@/components/views/CalendarView');
          break;
        case 'gantt':
          mod = await import('@/components/views/GanttView');
          break;
        case 'form':
          mod = await import('@/components/views/FormView');
          break;
        case 'gallery':
          mod = await import('@/components/views/GalleryView');
          break;
        default:
          mod = await import('@/components/sheet/SheetTable');
      }
      if (cancelled) return;
      setComp(() => (mod as { default: React.ComponentType<ViewProps> }).default);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeView]);
  return Comp;
}

'use client';

/**
 * Project detail route — `/w/{slug}/p/{projectSlug}`.
 *
 * Thin wrapper around WorkspaceShell, which holds all the rendering
 * + sync + dock logic shared with the workspace-level URL
 * (`/w/{slug}`) and the Linear-style routes added in Phase 1.
 */

import { useParams } from 'next/navigation';
import WorkspaceShell from '@/app/components/WorkspaceShell';

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string; projectSlug: string }>();
  return (
    <WorkspaceShell
      workspaceSlug={params?.slug ?? ''}
      initialProjectSlug={params?.projectSlug ?? null}
    />
  );
}

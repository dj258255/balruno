'use client';

/**
 * Project detail — Linear-style URL `/{wsSlug}/projects/{projectSlug}`.
 *
 * Thin wrapper that mounts the same WorkspaceShell as the legacy
 * `/w/{slug}/p/{projectSlug}` route. Phase 1 of the URL migration
 * keeps both paths live; Phase 2 will redirect old → new.
 */

import { useParams } from 'next/navigation';
import WorkspaceShell from '@/app/components/WorkspaceShell';

export default function ProjectDetailRoute() {
  const params = useParams<{ wsSlug: string; projectSlug: string }>();
  return (
    <WorkspaceShell
      workspaceSlug={params?.wsSlug ?? ''}
      initialProjectSlug={params?.projectSlug ?? null}
    />
  );
}

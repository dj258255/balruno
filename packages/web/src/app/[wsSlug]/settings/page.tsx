'use client';

/**
 * Workspace settings — Linear-style URL `/{wsSlug}/settings`.
 *
 * Mounts the same WorkspaceSettingsClient as the legacy
 * `/w/{slug}/settings` route. The client reads either
 * `params.wsSlug` (new) or `params.slug` (legacy) so a single
 * implementation serves both URL shapes.
 */

import WorkspaceSettingsClient from '@/app/components/WorkspaceSettingsClient';

export default function WorkspaceSettingsRoute() {
  return <WorkspaceSettingsClient />;
}

'use client';

/**
 * Legacy workspace settings route. The Phase 2 redirect in
 * next.config.ts permanently sends `/w/{slug}/settings` →
 * `/{slug}/settings`; this file stays as a thin import for the
 * unlikely case a fork bypasses the redirect (e.g. a self-host
 * operator behind a proxy that strips next-config redirects).
 */

import WorkspaceSettingsClient from '@/app/components/WorkspaceSettingsClient';

export default function LegacyWorkspaceSettingsPage() {
  return <WorkspaceSettingsClient />;
}

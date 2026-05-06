'use client';

import { useEffect } from 'react';

import { useBackendAuthStore } from '@/stores/backendAuthStore';

/**
 * Bootstraps the user identity store on first client mount.
 *
 * Without this a hard-navigate (URL bar, browser refresh, bookmark)
 * into an authenticated page leaves {@code useBackendAuthStore.user}
 * null even though the httpOnly session cookie is valid — middleware
 * lets the request through, but components that branch on user
 * identity (member-management modal admin gate, sidebar role display)
 * render in their "anonymous" state until something else triggers a
 * /me probe.
 *
 * Idempotent: the store skips while {@code status === 'loading'} and
 * also no-ops once it has reached 'authenticated' or 'anonymous', so
 * re-mounts under strict mode are free.
 *
 * Mounted at the body root from {@link RootLayout}, alongside the
 * desktop adapter bootstrapper.
 */
export function BackendAuthBootstrap() {
  useEffect(() => {
    const status = useBackendAuthStore.getState().status;
    if (status === 'idle') {
      void useBackendAuthStore.getState().bootstrap();
    }
  }, []);
  return null;
}
